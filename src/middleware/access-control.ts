import { NextFunction, Response } from "express";
import { DataSource } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { Assignment } from "../entities/assignment.js";
import { CourseLecturer } from "../entities/course-lecturer.js";
import { Enrollment } from "../entities/enrollment.js";
import {
  LecturerPermission,
  MembershipStatus,
  UserRole,
} from "../entities/enums.js";
import { isUuid } from "../controllers/user-controller.utils.js";
import type { LtiLaunchSyncResult } from "../services/lti-launch-sync.service.js";
import { AuthenticatedRequest, requireLtiAuth } from "./lti-auth.js";

type Middleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

/**
 * Local development without a Moodle launch relies on caller-supplied IDs.
 * That mode performs no ownership checks and must never be enabled in a
 * shared or production environment.
 */
export const isInsecureDevAuthEnabled = (): boolean =>
  process.env.ALLOW_INSECURE_DEV_AUTH === "true";

const forbid = (
  res: Response,
  message = "You do not have access to this resource",
): void => {
  res.status(403).json({ message });
};

export class CourseAccessService {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  isCourseLecturer(
    lecturerId: string,
    courseId: string,
    permissionLevel?: LecturerPermission,
  ): Promise<boolean> {
    return this.dataSource.getRepository(CourseLecturer).existsBy({
      lecturerId,
      courseId,
      ...(permissionLevel ? { permissionLevel } : {}),
    });
  }

  isEnrolled(studentId: string, courseId: string): Promise<boolean> {
    return this.dataSource.getRepository(Enrollment).existsBy({
      studentId,
      courseId,
      status: MembershipStatus.ACTIVE,
    });
  }

  canAccessCourse(
    auth: LtiLaunchSyncResult,
    courseId: string,
  ): Promise<boolean> {
    return auth.role === UserRole.LECTURER
      ? this.isCourseLecturer(auth.userId, courseId)
      : this.isEnrolled(auth.userId, courseId);
  }

  async findAssignmentCourseId(assignmentId: string): Promise<string | null> {
    const assignment = await this.dataSource.getRepository(Assignment).findOne({
      where: { id: assignmentId },
      select: { id: true, courseId: true },
    });
    return assignment?.courseId ?? null;
  }

  async listCourseIds(userId: string): Promise<Set<string>> {
    const [enrollments, lecturerships] = await Promise.all([
      this.dataSource.getRepository(Enrollment).find({
        where: { studentId: userId, status: MembershipStatus.ACTIVE },
        select: { courseId: true },
      }),
      this.dataSource.getRepository(CourseLecturer).find({
        where: { lecturerId: userId },
        select: { courseId: true },
      }),
    ]);
    return new Set(
      [...enrollments, ...lecturerships].map((item) => item.courseId),
    );
  }

  async shareCourse(firstUserId: string, secondUserId: string): Promise<boolean> {
    const [first, second] = await Promise.all([
      this.listCourseIds(firstUserId),
      this.listCourseIds(secondUserId),
    ]);
    return [...first].some((courseId) => second.has(courseId));
  }
}

export const createAccessControl = (
  access: CourseAccessService = new CourseAccessService(),
) => {
  const withCourse =
    (
      resolveCourseId: (req: AuthenticatedRequest) => Promise<string | null>,
      check: (auth: LtiLaunchSyncResult, courseId: string) => Promise<boolean>,
    ): Middleware =>
    async (req, res, next) => {
      if (!req.auth) {
        next();
        return;
      }
      try {
        const courseId = await resolveCourseId(req);
        if (!courseId) {
          next();
          return;
        }
        if (!(await check(req.auth, courseId))) {
          forbid(res);
          return;
        }
        next();
      } catch (error) {
        console.error("Failed to authorize course access:", error);
        res.status(500).json({ message: "Failed to authorize request" });
      }
    };

  const courseParam =
    (param: string) =>
    async (req: AuthenticatedRequest): Promise<string | null> => {
      const value = req.params[param];
      return typeof value === "string" && isUuid(value) ? value : null;
    };

  const assignmentCourse =
    (param: string) =>
    async (req: AuthenticatedRequest): Promise<string | null> => {
      const value = req.params[param];
      return typeof value === "string" && isUuid(value)
        ? access.findAssignmentCourseId(value)
        : null;
    };

  const lecturerOf =
    (permissionLevel?: LecturerPermission) =>
    async (auth: LtiLaunchSyncResult, courseId: string): Promise<boolean> =>
      auth.role === UserRole.LECTURER &&
      access.isCourseLecturer(auth.userId, courseId, permissionLevel);

  const memberOf = (auth: LtiLaunchSyncResult, courseId: string) =>
    access.canAccessCourse(auth, courseId);

  return {
    access,
    /**
     * Requires a valid LTI session. Requests without one are rejected unless
     * the insecure local-development fallback is explicitly enabled.
     */
    requireIdentity: (async (req, res, next) => {
      if (res.locals.token) {
        await requireLtiAuth(req, res, next);
        return;
      }
      if (isInsecureDevAuthEnabled()) {
        next();
        return;
      }
      res.status(401).json({ message: "Missing LTI session" });
    }) as Middleware,
    requireSelf:
      (param: string): Middleware =>
      (req, res, next) => {
        if (req.auth && req.params[param] !== req.auth.userId) {
          forbid(res);
          return;
        }
        next();
      },
    requireRole:
      (role: UserRole): Middleware =>
      (req, res, next) => {
        if (req.auth && req.auth.role !== role) {
          forbid(
            res,
            role === UserRole.LECTURER
              ? "Lecturer role required"
              : "Student role required",
          );
          return;
        }
        next();
      },
    /** Only available through the explicit local-development fallback. */
    requireInsecureDevAuth: ((req, res, next) => {
      if (!isInsecureDevAuthEnabled()) {
        forbid(res, "This endpoint is only available in local development");
        return;
      }
      next();
    }) as Middleware,
    requireCourseMember: (param = "courseId") =>
      withCourse(courseParam(param), memberOf),
    requireCourseLecturer: (
      param = "courseId",
      permissionLevel?: LecturerPermission,
    ) => withCourse(courseParam(param), lecturerOf(permissionLevel)),
    requireAssignmentMember: (param = "assignmentId") =>
      withCourse(assignmentCourse(param), memberOf),
    requireAssignmentLecturer: (param = "assignmentId") =>
      withCourse(assignmentCourse(param), lecturerOf()),
  };
};

export const accessControl = createAccessControl();
