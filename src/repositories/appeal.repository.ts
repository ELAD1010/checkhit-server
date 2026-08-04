import { DataSource, FindOptionsWhere, In, Repository } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { Appeal } from "../entities/appeal.js";
import { AppealStatus, EvaluationStatus } from "../entities/enums.js";
import { Evaluation } from "../entities/evaluation.js";
import { Lecturer } from "../entities/lecturer.js";
import { Student } from "../entities/student.js";

export class AppealStudentNotFoundError extends Error {
  constructor(studentId: string) {
    super(`Student with ID ${studentId} was not found`);
    this.name = "AppealStudentNotFoundError";
  }
}

export class AppealLecturerNotFoundError extends Error {
  constructor(lecturerId: string) {
    super(`Lecturer with ID ${lecturerId} was not found`);
    this.name = "AppealLecturerNotFoundError";
  }
}

export class AppealNotFoundError extends Error {
  constructor(appealId: string) {
    super(`Appeal with ID ${appealId} was not found`);
    this.name = "AppealNotFoundError";
  }
}

export interface StudentAppealsQueryOptions {
  limit?: number;
  status?: "IN_PROGRESS" | "PENDING" | AppealStatus | string;
}

export interface LecturerAppealsQueryOptions {
  status?: "PENDING" | "IN_PROGRESS" | "RESOLVED" | AppealStatus | string;
  courseId?: string;
  search?: string;
  limit?: number;
}

export interface LecturerAppealsStatsResult {
  pendingCount: number;
  resolvedCount: number;
  totalCount: number;
}

export interface ResolveAppealInput {
  status: AppealStatus.ACCEPTED | AppealStatus.REJECTED;
  resolution: string;
  reviewerId: string;
  newScore?: number;
}

export class AppealRepository {
  private appealRepo: Repository<Appeal>;
  private studentRepo: Repository<Student>;
  private lecturerRepo: Repository<Lecturer>;
  private evaluationRepo: Repository<Evaluation>;

  constructor(private readonly dataSource: DataSource = AppDataSource) {
    this.appealRepo = dataSource.getRepository(Appeal);
    this.studentRepo = dataSource.getRepository(Student);
    this.lecturerRepo = dataSource.getRepository(Lecturer);
    this.evaluationRepo = dataSource.getRepository(Evaluation);
  }

  async findAppealsByStudentId(
    studentId: string,
    options?: StudentAppealsQueryOptions,
  ): Promise<Appeal[]> {
    const student = await this.studentRepo.findOne({
      where: { userId: studentId },
    });

    if (!student) {
      throw new AppealStudentNotFoundError(studentId);
    }

    const whereClause: FindOptionsWhere<Appeal> = { studentId };

    if (options?.status) {
      const statusUpper = options.status.toUpperCase();
      if (statusUpper === "IN_PROGRESS" || statusUpper === "PENDING") {
        whereClause.status = In([
          AppealStatus.SUBMITTED,
          AppealStatus.UNDER_REVIEW,
        ]);
      } else if (
        Object.values(AppealStatus).includes(statusUpper as AppealStatus)
      ) {
        whereClause.status = statusUpper as AppealStatus;
      }
    }

    return this.appealRepo.find({
      where: whereClause,
      relations: {
        submission: {
          assignment: {
            course: true,
          },
        },
        evaluation: true,
        reviewer: {
          user: true,
        },
        files: {
          file: true,
        },
      },
      order: {
        createdAt: "DESC",
      },
      take: options?.limit && options.limit > 0 ? options.limit : undefined,
    });
  }

  async findAppealsByLecturerId(
    lecturerId: string,
    options?: LecturerAppealsQueryOptions,
  ): Promise<Appeal[]> {
    const lecturer = await this.lecturerRepo.findOne({
      where: { userId: lecturerId },
    });

    if (!lecturer) {
      throw new AppealLecturerNotFoundError(lecturerId);
    }

    const qb = this.appealRepo
      .createQueryBuilder("appeal")
      .innerJoinAndSelect("appeal.submission", "submission")
      .innerJoinAndSelect("submission.assignment", "assignment")
      .innerJoinAndSelect("assignment.course", "course")
      .innerJoin(
        "course.lecturers",
        "courseLecturer",
        "courseLecturer.lecturerId = :lecturerId",
        { lecturerId },
      )
      .innerJoinAndSelect("appeal.student", "student")
      .innerJoinAndSelect("student.user", "user")
      .leftJoinAndSelect("appeal.evaluation", "evaluation")
      .leftJoinAndSelect("appeal.reviewer", "reviewer")
      .leftJoinAndSelect("reviewer.user", "reviewerUser")
      .leftJoinAndSelect("appeal.files", "appealFile")
      .leftJoinAndSelect("appealFile.file", "fileAsset");

    if (options?.courseId) {
      qb.andWhere("course.id = :courseId", { courseId: options.courseId });
    }

    if (options?.status) {
      const statusUpper = options.status.toUpperCase();
      if (statusUpper === "PENDING" || statusUpper === "IN_PROGRESS") {
        qb.andWhere("appeal.status IN (:...pendingStatuses)", {
          pendingStatuses: [
            AppealStatus.SUBMITTED,
            AppealStatus.UNDER_REVIEW,
          ],
        });
      } else if (statusUpper === "RESOLVED") {
        qb.andWhere("appeal.status IN (:...resolvedStatuses)", {
          resolvedStatuses: [
            AppealStatus.ACCEPTED,
            AppealStatus.REJECTED,
            AppealStatus.CANCELLED,
          ],
        });
      } else if (
        Object.values(AppealStatus).includes(statusUpper as AppealStatus)
      ) {
        qb.andWhere("appeal.status = :status", { status: statusUpper });
      }
    }

    if (options?.search && options.search.trim()) {
      const trimmed = options.search.trim();
      qb.andWhere(
        "(LOWER(user.name) LIKE LOWER(:search) OR CAST(student.userId AS TEXT) LIKE :searchRaw)",
        {
          search: `%${trimmed}%`,
          searchRaw: `%${trimmed}%`,
        },
      );
    }

    qb.orderBy("appeal.createdAt", "DESC");

    if (options?.limit && options.limit > 0) {
      qb.take(options.limit);
    }

    return qb.getMany();
  }

  async getLecturerAppealsStats(
    lecturerId: string,
  ): Promise<LecturerAppealsStatsResult> {
    const lecturer = await this.lecturerRepo.findOne({
      where: { userId: lecturerId },
    });

    if (!lecturer) {
      throw new AppealLecturerNotFoundError(lecturerId);
    }

    const rawStats: { status: AppealStatus; count: string }[] =
      await this.appealRepo
        .createQueryBuilder("appeal")
        .innerJoin("appeal.submission", "submission")
        .innerJoin("submission.assignment", "assignment")
        .innerJoin("assignment.course", "course")
        .innerJoin(
          "course.lecturers",
          "courseLecturer",
          "courseLecturer.lecturerId = :lecturerId",
          { lecturerId },
        )
        .select("appeal.status", "status")
        .addSelect("COUNT(appeal.id)", "count")
        .groupBy("appeal.status")
        .getRawMany();

    let pendingCount = 0;
    let resolvedCount = 0;
    let totalCount = 0;

    for (const stat of rawStats) {
      const cnt = parseInt(stat.count, 10) || 0;
      totalCount += cnt;
      if (
        stat.status === AppealStatus.SUBMITTED ||
        stat.status === AppealStatus.UNDER_REVIEW
      ) {
        pendingCount += cnt;
      } else if (
        stat.status === AppealStatus.ACCEPTED ||
        stat.status === AppealStatus.REJECTED ||
        stat.status === AppealStatus.CANCELLED
      ) {
        resolvedCount += cnt;
      }
    }

    return {
      pendingCount,
      resolvedCount,
      totalCount,
    };
  }

  async findAppealById(appealId: string): Promise<Appeal | null> {
    return this.appealRepo.findOne({
      where: { id: appealId },
      relations: {
        student: {
          user: true,
        },
        submission: {
          assignment: {
            course: true,
          },
          files: {
            file: true,
          },
        },
        evaluation: true,
        reviewer: {
          user: true,
        },
        files: {
          file: true,
        },
      },
    });
  }

  async resolveAppeal(
    appealId: string,
    input: ResolveAppealInput,
  ): Promise<Appeal> {
    return this.dataSource.transaction(async (manager) => {
      const appealRepo = manager.getRepository(Appeal);
      const evalRepo = manager.getRepository(Evaluation);
      const lecturerRepo = manager.getRepository(Lecturer);

      const appeal = await appealRepo.findOne({
        where: { id: appealId },
        relations: {
          submission: true,
          evaluation: true,
        },
      });

      if (!appeal) {
        throw new AppealNotFoundError(appealId);
      }

      const lecturer = await lecturerRepo.findOne({
        where: { userId: input.reviewerId },
      });

      if (!lecturer) {
        throw new AppealLecturerNotFoundError(input.reviewerId);
      }

      let savedEvalId: string | undefined;

      // If accepted with a new score, create/update the final evaluation
      if (
        input.status === AppealStatus.ACCEPTED &&
        typeof input.newScore === "number" &&
        !isNaN(input.newScore)
      ) {
        // 1. Unmark previous final evaluations for this submission
        await evalRepo
          .createQueryBuilder()
          .update(Evaluation)
          .set({ isFinal: false })
          .where("submissionId = :submissionId", {
            submissionId: appeal.submissionId,
          })
          .execute();

        // 2. Create a new final evaluation with the updated score
        const maxScore = appeal.evaluation?.maxScore ?? 100;
        const newEvaluation = evalRepo.create({
          submissionId: appeal.submissionId,
          score: input.newScore,
          maxScore,
          feedback: input.resolution,
          model: "lecturer-manual-appeal-resolution",
          promptVersion: "v1.0",
          status: EvaluationStatus.COMPLETED,
          isFinal: true,
        });

        const savedEval = await evalRepo.save(newEvaluation);
        savedEvalId = savedEval.id;
      }

      await appealRepo.update(appealId, {
        status: input.status,
        resolution: input.resolution,
        reviewerId: input.reviewerId,
        resolvedAt: new Date(),
        ...(savedEvalId ? { evaluationId: savedEvalId } : {}),
      });

      // Return refreshed appeal with all relations
      return (await manager.getRepository(Appeal).findOne({
        where: { id: appealId },
        relations: {
          student: {
            user: true,
          },
          submission: {
            assignment: {
              course: true,
            },
            files: {
              file: true,
            },
          },
          evaluation: true,
          reviewer: {
            user: true,
          },
          files: {
            file: true,
          },
        },
      }))!;
    });
  }
}
