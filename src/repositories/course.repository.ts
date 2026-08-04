import { DataSource, EntityManager, In, SelectQueryBuilder } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { CourseLecturer } from "../entities/course-lecturer.js";
import { Course } from "../entities/course.js";
import { Enrollment } from "../entities/enrollment.js";
import { LecturerPermission, MembershipStatus } from "../entities/enums.js";
import { Lecturer } from "../entities/lecturer.js";

export type CreateCourseInput = {
  name: string;
  semester: string;
  academicYear: number;
  lecturerIds: string[];
  ltiContextId?: string | null;
};

export class LecturersNotFoundError extends Error {
  constructor(readonly lecturerIds: string[]) {
    super(`Lecturers not found: ${lecturerIds.join(", ")}`);
    this.name = "LecturersNotFoundError";
  }
}

export class CourseRepository {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  async createCourse(input: CreateCourseInput): Promise<Course> {
    return this.dataSource.transaction(async (manager) => {
      const lecturerIds = [...new Set(input.lecturerIds)];
      await this.assertLecturersExist(manager, lecturerIds);

      const courseRepository = manager.getRepository(Course);
      const course = await courseRepository.save(
        courseRepository.create({
          name: input.name,
          semester: input.semester,
          academicYear: input.academicYear,
          ltiContextId: input.ltiContextId ?? null,
        }),
      );

      const courseLecturerRepository = manager.getRepository(CourseLecturer);
      await courseLecturerRepository.save(
        lecturerIds.map((lecturerId, index) =>
          courseLecturerRepository.create({
            courseId: course.id,
            lecturerId,
            permissionLevel:
              index === 0
                ? LecturerPermission.OWNER
                : LecturerPermission.EDITOR,
          }),
        ),
      );

      const createdCourse = await this.findCourseByIdWithManager(
        manager,
        course.id,
      );

      if (!createdCourse) {
        throw new Error("Created course could not be loaded");
      }

      return createdCourse;
    });
  }

  async findCourseById(courseId: string): Promise<Course | null> {
    return this.findCourseByIdWithManager(this.dataSource.manager, courseId);
  }

  async findCoursesByLecturerId(lecturerId: string): Promise<Course[]> {
    const qb = this.dataSource
      .getRepository(Course)
      .createQueryBuilder("course")
      .innerJoin(
        "course.lecturers",
        "managedCourse",
        "managedCourse.lecturer_id = :lecturerId",
        { lecturerId },
      )
      .leftJoinAndSelect("course.lecturers", "courseLecturer")
      .leftJoinAndSelect("courseLecturer.lecturer", "lecturer")
      .leftJoinAndSelect("lecturer.user", "user")
      .orderBy("course.academic_year", "DESC")
      .addOrderBy("course.semester", "ASC")
      .addOrderBy("course.name", "ASC");

    this.addActiveStudentsCountSubquery(qb);

    const rawAndEntities = await qb.getRawAndEntities();
    return this.mapStudentsCount(rawAndEntities);
  }

  async findCoursesByStudentId(studentId: string): Promise<Course[]> {
    const qb = this.dataSource
      .getRepository(Course)
      .createQueryBuilder("course")
      .innerJoin(
        "course.enrollments",
        "enrollment",
        "enrollment.student_id = :studentId AND enrollment.status = :status",
        {
          studentId,
          status: MembershipStatus.ACTIVE,
        },
      )
      .leftJoinAndSelect("course.lecturers", "courseLecturer")
      .leftJoinAndSelect("courseLecturer.lecturer", "lecturer")
      .leftJoinAndSelect("lecturer.user", "user")
      .orderBy("course.academic_year", "DESC")
      .addOrderBy("course.semester", "ASC")
      .addOrderBy("course.name", "ASC");

    this.addActiveStudentsCountSubquery(qb);

    const rawAndEntities = await qb.getRawAndEntities();
    return this.mapStudentsCount(rawAndEntities);
  }

  async deleteCourse(courseId: string): Promise<boolean> {
    const result = await this.dataSource.getRepository(Course).delete(courseId);
    return result.affected === 1;
  }

  private async assertLecturersExist(
    manager: EntityManager,
    lecturerIds: string[],
  ): Promise<void> {
    const lecturers = await manager.getRepository(Lecturer).findBy({
      userId: In(lecturerIds),
    });
    const existingIds = new Set(lecturers.map((lecturer) => lecturer.userId));
    const missingIds = lecturerIds.filter(
      (lecturerId) => !existingIds.has(lecturerId),
    );

    if (missingIds.length > 0) {
      throw new LecturersNotFoundError(missingIds);
    }
  }

  private async findCourseByIdWithManager(
    manager: EntityManager,
    courseId: string,
  ): Promise<Course | null> {
    const qb = manager
      .getRepository(Course)
      .createQueryBuilder("course")
      .where("course.id = :courseId", { courseId })
      .leftJoinAndSelect("course.lecturers", "courseLecturer")
      .leftJoinAndSelect("courseLecturer.lecturer", "lecturer")
      .leftJoinAndSelect("lecturer.user", "user");

    this.addActiveStudentsCountSubquery(qb);

    const rawAndEntities = await qb.getRawAndEntities();
    const courses = this.mapStudentsCount(rawAndEntities);
    return courses[0] ?? null;
  }

  private addActiveStudentsCountSubquery(
    qb: SelectQueryBuilder<Course>,
  ): SelectQueryBuilder<Course> {
    return qb.addSelect((subQuery) => {
      return subQuery
        .select("COUNT(enrollment.studentId)", "studentsCount")
        .from(Enrollment, "enrollment")
        .where("enrollment.courseId = course.id")
        .andWhere("enrollment.status = :activeEnrollmentStatus", {
          activeEnrollmentStatus: MembershipStatus.ACTIVE,
        });
    }, "course_students_count");
  }

  private mapStudentsCount(rawAndEntities: {
    entities: Course[];
    raw: Record<string, unknown>[];
  }): Course[] {
    return rawAndEntities.entities.map((entity, idx) => {
      const raw = rawAndEntities.raw[idx];
      const count =
        raw?.course_students_count ??
        raw?.studentsCount ??
        raw?.course_studentsCount ??
        0;
      entity.studentsCount = Number(count);
      return entity;
    });
  }
}
