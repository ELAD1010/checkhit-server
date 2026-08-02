import { DataSource, EntityManager } from "typeorm";
import { LECTURER_ROLE, STUDENT_ROLE } from "../common/consts/roles.js";
import { LtiToken } from "../common/types/lti.js";
import { AppDataSource } from "../database/data-source.js";
import { Assignment } from "../entities/assignment.js";
import { CourseLecturer } from "../entities/course-lecturer.js";
import { Course } from "../entities/course.js";
import {
  LecturerPermission,
  MembershipStatus,
  UserRole,
} from "../entities/enums.js";
import { Enrollment } from "../entities/enrollment.js";
import { Lecturer } from "../entities/lecturer.js";
import { LtiCourseContext } from "../entities/lti-course-context.js";
import { LtiPlatform } from "../entities/lti-platform.js";
import { LtiResourceLink } from "../entities/lti-resource-link.js";
import { LtiUserIdentity } from "../entities/lti-user-identity.js";
import { Student } from "../entities/student.js";
import { User } from "../entities/user.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MoodleCourseMetadata = {
  name?: string;
  semester?: string;
  academicYear?: number;
};

export type LtiLaunchSyncResult = {
  userId: string;
  courseId: string;
  assignmentId: string | null;
  role: UserRole;
};

export class LtiLaunchDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LtiLaunchDataError";
  }
}

export class LtiRoleConflictError extends Error {
  constructor(
    readonly userId: string,
    readonly storedRole: UserRole,
    readonly launchRole: UserRole,
  ) {
    super(
      `User ${userId} has global role ${storedRole}, but Moodle launched as ${launchRole}`,
    );
    this.name = "LtiRoleConflictError";
  }
}

export class LtiLaunchSyncService {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  async synchronize(
    token: LtiToken,
    courseMetadata: MoodleCourseMetadata = {},
  ): Promise<LtiLaunchSyncResult> {
    return this.dataSource.transaction(async (manager) => {
      const platform = await this.resolvePlatform(manager, token);
      const role = this.resolveRole(token.platformContext.roles);
      const user = await this.resolveUser(manager, platform.id, token, role);
      const course = await this.resolveCourse(
        manager,
        platform.id,
        token,
        courseMetadata,
      );

      await this.ensureMembership(manager, user.id, course.id, role);
      const assignmentId = await this.resolveAssignment(
        manager,
        platform.id,
        course.id,
        token,
      );

      return {
        userId: user.id,
        courseId: course.id,
        assignmentId,
        role,
      };
    });
  }

  private async resolvePlatform(
    manager: EntityManager,
    token: LtiToken,
  ): Promise<LtiPlatform> {
    const issuer = token.iss;
    const clientId = token.clientId ?? process.env.MOODLE_CLIENT_ID;
    const deploymentId =
      token.deploymentId ?? token.platformContext.deploymentId;

    if (!issuer || !clientId || !deploymentId) {
      throw new LtiLaunchDataError(
        "LTI launch is missing issuer, client ID, or deployment ID",
      );
    }

    const repository = manager.getRepository(LtiPlatform);
    await repository.upsert(
      { issuer, clientId, deploymentId },
      {
        conflictPaths: ["issuer", "clientId", "deploymentId"],
        skipUpdateIfNoValuesChanged: true,
      },
    );

    return repository.findOneByOrFail({ issuer, clientId, deploymentId });
  }

  private resolveRole(roles: string[]): UserRole {
    if (roles.includes(LECTURER_ROLE)) {
      return UserRole.LECTURER;
    }

    if (roles.includes(STUDENT_ROLE)) {
      return UserRole.STUDENT;
    }

    throw new LtiLaunchDataError(
      "LTI launch does not contain a supported Instructor or Learner role",
    );
  }

  private async resolveUser(
    manager: EntityManager,
    platformId: string,
    token: LtiToken,
    role: UserRole,
  ): Promise<User> {
    if (!token.user) {
      throw new LtiLaunchDataError("LTI launch is missing the user subject");
    }

    const identityRepository = manager.getRepository(LtiUserIdentity);
    const identity = await identityRepository.findOne({
      where: { platformId, subject: token.user },
      relations: { user: true },
    });
    const email = token.userInfo?.email?.trim().toLowerCase() || null;
    const name = token.userInfo?.name?.trim() || `Moodle user ${token.user}`;
    let user = identity?.user ?? null;

    if (!user && email) {
      user = await manager.getRepository(User).findOneBy({ email });
    }

    if (user && user.role !== role) {
      throw new LtiRoleConflictError(user.id, user.role, role);
    }

    const userRepository = manager.getRepository(User);

    if (!user) {
      user = await userRepository.save(
        userRepository.create({
          name,
          email,
          role,
          ltiSubject: token.user,
        }),
      );
    } else {
      user.name = name;
      user.email = email ?? user.email;
      user.ltiSubject ??= token.user;
      user = await userRepository.save(user);
    }

    if (!identity) {
      await identityRepository.save(
        identityRepository.create({
          platformId,
          subject: token.user,
          userId: user.id,
        }),
      );
    }

    await this.ensureRoleProfile(manager, user.id, role);
    return user;
  }

  private async ensureRoleProfile(
    manager: EntityManager,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    if (role === UserRole.LECTURER) {
      await manager
        .getRepository(Lecturer)
        .upsert({ userId }, { conflictPaths: ["userId"] });
      return;
    }

    await manager
      .getRepository(Student)
      .upsert({ userId }, { conflictPaths: ["userId"] });
  }

  private async resolveCourse(
    manager: EntityManager,
    platformId: string,
    token: LtiToken,
    metadata: MoodleCourseMetadata,
  ): Promise<Course> {
    const context = token.platformContext.context;

    if (!context?.id) {
      throw new LtiLaunchDataError("LTI launch is missing the course context");
    }

    const contextRepository = manager.getRepository(LtiCourseContext);
    const mapping = await contextRepository.findOne({
      where: { platformId, contextId: context.id },
      relations: { course: true },
    });
    const name =
      metadata.name?.trim() ||
      context.title?.trim() ||
      context.label?.trim() ||
      `Moodle course ${context.id}`;
    let course = mapping?.course ?? null;

    if (!course) {
      course = await manager.getRepository(Course).findOneBy({
        ltiContextId: context.id,
      });
    }

    const courseRepository = manager.getRepository(Course);

    if (!course) {
      course = await courseRepository.save(
        courseRepository.create({
          name,
          semester:
            metadata.semester?.trim() || context.label?.trim() || "Moodle",
          academicYear:
            metadata.academicYear ?? new Date().getUTCFullYear(),
          ltiContextId: context.id,
        }),
      );
    } else {
      course.name = name;
      course.ltiContextId ??= context.id;

      if (metadata.semester?.trim()) {
        course.semester = metadata.semester.trim();
      }

      if (metadata.academicYear) {
        course.academicYear = metadata.academicYear;
      }

      course = await courseRepository.save(course);
    }

    await contextRepository.upsert(
      {
        platformId,
        contextId: context.id,
        courseId: course.id,
        title: context.title?.trim() || null,
        label: context.label?.trim() || null,
      },
      {
        conflictPaths: ["platformId", "contextId"],
      },
    );

    return course;
  }

  private async ensureMembership(
    manager: EntityManager,
    userId: string,
    courseId: string,
    role: UserRole,
  ): Promise<void> {
    if (role === UserRole.STUDENT) {
      await manager.getRepository(Enrollment).upsert(
        {
          studentId: userId,
          courseId,
          status: MembershipStatus.ACTIVE,
        },
        { conflictPaths: ["studentId", "courseId"] },
      );
      return;
    }

    const repository = manager.getRepository(CourseLecturer);
    const existing = await repository.findOneBy({
      courseId,
      lecturerId: userId,
    });

    if (existing) {
      return;
    }

    const lecturerCount = await repository.countBy({ courseId });
    await repository.save(
      repository.create({
        courseId,
        lecturerId: userId,
        permissionLevel:
          lecturerCount === 0
            ? LecturerPermission.OWNER
            : LecturerPermission.EDITOR,
      }),
    );
  }

  private async resolveAssignment(
    manager: EntityManager,
    platformId: string,
    courseId: string,
    token: LtiToken,
  ): Promise<string | null> {
    const resource = token.platformContext.resource;

    if (!resource?.id) {
      return null;
    }

    const repository = manager.getRepository(LtiResourceLink);
    const existing = await repository.findOneBy({
      platformId,
      resourceLinkId: resource.id,
    });
    const taskId = token.platformContext.custom?.taskId;
    let assignment: Assignment | null = null;

    if (taskId && UUID_PATTERN.test(taskId)) {
      assignment = await manager.getRepository(Assignment).findOneBy({
        id: taskId,
        courseId,
      });
    }

    if (!assignment && existing) {
      assignment = await manager
        .getRepository(Assignment)
        .findOneBy({ id: existing.assignmentId, courseId });
    }

    if (!assignment) {
      assignment = await manager.getRepository(Assignment).findOneBy({
        courseId,
        ltiResourceLinkId: resource.id,
      });
    }

    if (!assignment) {
      return null;
    }

    const lineItemUrl = token.platformContext.endpoint?.lineItem ?? null;
    await repository.upsert(
      {
        platformId,
        resourceLinkId: resource.id,
        assignmentId: assignment.id,
        courseId,
        title: resource.title?.trim() || null,
        lineItemUrl,
      },
      { conflictPaths: ["platformId", "resourceLinkId"] },
    );

    assignment.ltiResourceLinkId = resource.id;
    assignment.ltiLineItemUrl = lineItemUrl;
    await manager.getRepository(Assignment).save(assignment);
    return assignment.id;
  }
}
