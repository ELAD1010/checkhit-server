import { DataSource, EntityManager, In } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { CourseLecturer } from "../entities/course-lecturer.js";
import { Course } from "../entities/course.js";
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
    return this.dataSource
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
      .addOrderBy("course.name", "ASC")
      .getMany();
  }

  async findCoursesByStudentId(studentId: string): Promise<Course[]> {
    return this.dataSource
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
      .addOrderBy("course.name", "ASC")
      .getMany();
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

  private findCourseByIdWithManager(
    manager: EntityManager,
    courseId: string,
  ): Promise<Course | null> {
    return manager.getRepository(Course).findOne({
      where: { id: courseId },
      relations: {
        lecturers: {
          lecturer: {
            user: true,
          },
        },
      },
    });
  }
}
