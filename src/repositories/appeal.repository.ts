import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  Repository,
} from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { Appeal } from "../entities/appeal.js";
import { AppealFile } from "../entities/appeal-file.js";
import { CourseLecturer } from "../entities/course-lecturer.js";
import {
  AppealReviewSource,
  AppealStatus,
  EvaluationStatus,
  SubmissionStatus,
} from "../entities/enums.js";
import { Evaluation } from "../entities/evaluation.js";
import { FileAsset } from "../entities/file-asset.js";
import { Lecturer } from "../entities/lecturer.js";
import { Student } from "../entities/student.js";
import { Submission } from "../entities/submission.js";
import type { AppealAiRecommendation } from "../appeals/schemas.js";
import { evaluationRealtime } from "../realtime/evaluation-realtime.js";

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

export class AppealConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppealConflictError";
  }
}

export class AppealForbiddenError extends Error {
  constructor(message = "You are not allowed to access this appeal") {
    super(message);
    this.name = "AppealForbiddenError";
  }
}

export class AppealValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppealValidationError";
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

export interface CreateAppealInput {
  submissionId: string;
  studentId: string;
  reason: string;
  category?: string | null;
  fileIds?: string[];
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
        resultEvaluation: true,
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

  async createAppeal(input: CreateAppealInput): Promise<Appeal> {
    const appealId = await this.dataSource.transaction(async (manager) => {
      const submission = await manager.getRepository(Submission).findOne({
        where: { id: input.submissionId },
        relations: { evaluations: true, student: true },
        lock: { mode: "pessimistic_write" },
      });
      if (!submission) {
        throw new AppealValidationError("Submission was not found");
      }
      if (submission.studentId !== input.studentId) {
        throw new AppealForbiddenError(
          "Students may only appeal their own submissions",
        );
      }
      if (submission.status !== SubmissionStatus.SUBMITTED) {
        throw new AppealValidationError(
          "Only submitted and graded work can be appealed",
        );
      }
      const evaluation = submission.evaluations
        .filter(
          (item) => item.status === EvaluationStatus.COMPLETED && item.isFinal,
        )
        .sort(
          (a, b) =>
            (b.completedAt?.getTime() ?? b.createdAt.getTime()) -
            (a.completedAt?.getTime() ?? a.createdAt.getTime()),
        )[0];
      if (!evaluation || evaluation.score === null) {
        throw new AppealValidationError(
          "A completed final evaluation is required before appealing",
        );
      }
      const active = await manager.getRepository(Appeal).findOne({
        where: {
          evaluationId: evaluation.id,
          status: In([AppealStatus.SUBMITTED, AppealStatus.UNDER_REVIEW]),
        },
      });
      if (active) {
        throw new AppealConflictError(
          "An active appeal already exists for this evaluation",
        );
      }

      const fileIds = [...new Set(input.fileIds ?? [])];
      if (fileIds.length > 5) {
        throw new AppealValidationError(
          "An appeal can contain at most 5 files",
        );
      }
      if (fileIds.length > 0) {
        const files = await manager.getRepository(FileAsset).findBy({
          id: In(fileIds),
        });
        if (files.length !== fileIds.length) {
          throw new AppealValidationError(
            "One or more evidence files were not found",
          );
        }
      }

      const appeal = await manager.getRepository(Appeal).save(
        manager.getRepository(Appeal).create({
          submissionId: submission.id,
          evaluationId: evaluation.id,
          resultEvaluationId: null,
          studentId: input.studentId,
          reviewerId: null,
          reason: input.reason,
          category: input.category ?? null,
          status: AppealStatus.SUBMITTED,
          resolution: null,
          reviewSource: null,
          aiRecommendation: null,
          aiModel: null,
          aiReviewedAt: null,
          resolvedAt: null,
        }),
      );
      if (fileIds.length > 0) {
        await manager.getRepository(AppealFile).save(
          fileIds.map((fileId) =>
            manager.getRepository(AppealFile).create({
              appealId: appeal.id,
              fileId,
            }),
          ),
        );
      }
      return appeal.id;
    });
    return (await this.findAppealById(appealId))!;
  }

  async claimAppeal(appealId: string, lecturerId: string): Promise<Appeal> {
    await this.dataSource.transaction(async (manager) => {
      const appeal = await manager.getRepository(Appeal).findOne({
        where: { id: appealId },
        relations: { submission: { assignment: true } },
        lock: { mode: "pessimistic_write" },
      });
      if (!appeal) throw new AppealNotFoundError(appealId);
      await this.assertLecturerForCourse(
        lecturerId,
        appeal.submission.assignment.courseId,
        manager,
      );
      if (
        appeal.status === AppealStatus.UNDER_REVIEW &&
        appeal.reviewerId === lecturerId
      )
        return;
      if (
        appeal.status === AppealStatus.UNDER_REVIEW &&
        appeal.reviewerId === null
      ) {
        appeal.reviewerId = lecturerId;
        await manager.getRepository(Appeal).save(appeal);
        return;
      }
      if (appeal.status !== AppealStatus.SUBMITTED) {
        throw new AppealConflictError("Only submitted appeals can be claimed");
      }
      if (appeal.reviewerId && appeal.reviewerId !== lecturerId) {
        throw new AppealConflictError("The appeal is already assigned");
      }
      appeal.status = AppealStatus.UNDER_REVIEW;
      appeal.reviewerId = lecturerId;
      await manager.getRepository(Appeal).save(appeal);
    });
    return (await this.findAppealById(appealId))!;
  }

  async cancelAppeal(appealId: string, studentId: string): Promise<Appeal> {
    await this.dataSource.transaction(async (manager) => {
      const appeal = await manager.getRepository(Appeal).findOne({
        where: { id: appealId },
        lock: { mode: "pessimistic_write" },
      });
      if (!appeal) throw new AppealNotFoundError(appealId);
      if (appeal.studentId !== studentId) {
        throw new AppealForbiddenError(
          "Students may only cancel their own appeals",
        );
      }
      if (appeal.status !== AppealStatus.SUBMITTED) {
        throw new AppealConflictError(
          "An appeal can only be cancelled before review begins",
        );
      }
      appeal.status = AppealStatus.CANCELLED;
      appeal.resolvedAt = new Date();
      await manager.getRepository(Appeal).save(appeal);
    });
    return (await this.findAppealById(appealId))!;
  }

  async addEvidence(
    appealId: string,
    studentId: string,
    fileIds: string[],
  ): Promise<Appeal> {
    await this.dataSource.transaction(async (manager) => {
      const appeal = await manager.getRepository(Appeal).findOne({
        where: { id: appealId },
        relations: { files: true },
        lock: { mode: "pessimistic_write" },
      });
      if (!appeal) throw new AppealNotFoundError(appealId);
      if (appeal.studentId !== studentId) throw new AppealForbiddenError();
      if (appeal.status !== AppealStatus.SUBMITTED) {
        throw new AppealConflictError(
          "Evidence cannot be changed after review begins",
        );
      }
      const unique = [...new Set(fileIds)].filter(
        (id) => !appeal.files.some((link) => link.fileId === id),
      );
      if (appeal.files.length + unique.length > 5) {
        throw new AppealValidationError(
          "An appeal can contain at most 5 files",
        );
      }
      const files = await manager
        .getRepository(FileAsset)
        .findBy({ id: In(unique) });
      if (files.length !== unique.length) {
        throw new AppealValidationError(
          "One or more evidence files were not found",
        );
      }
      await manager
        .getRepository(AppealFile)
        .save(
          unique.map((fileId) =>
            manager.getRepository(AppealFile).create({ appealId, fileId }),
          ),
        );
    });
    return (await this.findAppealById(appealId))!;
  }

  async removeEvidence(
    appealId: string,
    studentId: string,
    fileId: string,
  ): Promise<Appeal> {
    await this.dataSource.transaction(async (manager) => {
      const appeal = await manager.getRepository(Appeal).findOne({
        where: { id: appealId },
        lock: { mode: "pessimistic_write" },
      });
      if (!appeal) throw new AppealNotFoundError(appealId);
      if (appeal.studentId !== studentId) throw new AppealForbiddenError();
      if (appeal.status !== AppealStatus.SUBMITTED) {
        throw new AppealConflictError(
          "Evidence cannot be changed after review begins",
        );
      }
      const result = await manager.getRepository(AppealFile).delete({
        appealId,
        fileId,
      });
      if (!result.affected) {
        throw new AppealValidationError(
          "Evidence file was not attached to this appeal",
        );
      }
    });
    return (await this.findAppealById(appealId))!;
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
      .leftJoinAndSelect("appeal.resultEvaluation", "resultEvaluation")
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
          pendingStatuses: [AppealStatus.SUBMITTED, AppealStatus.UNDER_REVIEW],
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
        resultEvaluation: true,
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
    let updatedEvaluationId: string | undefined;
    const resolvedAppeal = await this.dataSource.transaction(
      async (manager) => {
        const appealRepo = manager.getRepository(Appeal);
        const evalRepo = manager.getRepository(Evaluation);
        const appeal = await appealRepo.findOne({
          where: { id: appealId },
          relations: {
            submission: { assignment: true },
            evaluation: true,
          },
          lock: { mode: "pessimistic_write" },
        });

        if (!appeal) {
          throw new AppealNotFoundError(appealId);
        }

        await this.assertLecturerForCourse(
          input.reviewerId,
          appeal.submission.assignment.courseId,
          manager,
        );
        if (
          appeal.status !== AppealStatus.SUBMITTED &&
          appeal.status !== AppealStatus.UNDER_REVIEW
        ) {
          throw new AppealConflictError(
            "This appeal has already been resolved",
          );
        }
        if (appeal.reviewerId && appeal.reviewerId !== input.reviewerId) {
          throw new AppealConflictError(
            "This appeal is assigned to another lecturer",
          );
        }
        if (
          typeof input.newScore === "number" &&
          input.newScore > appeal.evaluation.maxScore
        ) {
          throw new AppealValidationError(
            `newScore cannot exceed ${appeal.evaluation.maxScore}`,
          );
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
            questionSetId: appeal.evaluation.questionSetId,
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
          updatedEvaluationId = savedEval.id;
        }

        await appealRepo.update(appealId, {
          status: input.status,
          resolution: input.resolution,
          reviewerId: input.reviewerId,
          reviewSource: AppealReviewSource.LECTURER,
          resolvedAt: new Date(),
          ...(savedEvalId ? { resultEvaluationId: savedEvalId } : {}),
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
            resultEvaluation: true,
            reviewer: {
              user: true,
            },
            files: {
              file: true,
            },
          },
        }))!;
      },
    );
    if (updatedEvaluationId) {
      await evaluationRealtime.publishEvaluation(updatedEvaluationId);
    }
    return resolvedAppeal;
  }

  async saveAiRecommendation(
    appealId: string,
    recommendation: AppealAiRecommendation,
    model: string,
  ): Promise<Appeal> {
    await this.dataSource.transaction(async (manager) => {
      const appeal = await manager.getRepository(Appeal).findOne({
        where: { id: appealId },
        relations: { evaluation: true },
        lock: { mode: "pessimistic_write" },
      });
      if (!appeal) throw new AppealNotFoundError(appealId);
      if (
        appeal.status !== AppealStatus.SUBMITTED &&
        appeal.status !== AppealStatus.UNDER_REVIEW
      ) {
        throw new AppealConflictError("This appeal has already been resolved");
      }
      if (recommendation.recommendedScore > appeal.evaluation.maxScore) {
        throw new AppealValidationError(
          `AI recommended score cannot exceed ${appeal.evaluation.maxScore}`,
        );
      }
      appeal.aiRecommendation = recommendation;
      appeal.aiModel = model;
      appeal.aiReviewedAt = new Date();
      appeal.status = AppealStatus.UNDER_REVIEW;
      await manager.getRepository(Appeal).save(appeal);
    });
    return (await this.findAppealById(appealId))!;
  }

  async resolveAppealByAi(
    appealId: string,
    recommendation: AppealAiRecommendation,
    model: string,
  ): Promise<Appeal> {
    let updatedEvaluationId: string | undefined;
    await this.dataSource.transaction(async (manager) => {
      const appeal = await manager.getRepository(Appeal).findOne({
        where: { id: appealId },
        relations: {
          evaluation: true,
          resultEvaluation: true,
          submission: { assignment: true },
        },
        lock: { mode: "pessimistic_write" },
      });
      if (!appeal) throw new AppealNotFoundError(appealId);
      if (
        appeal.status !== AppealStatus.SUBMITTED &&
        appeal.status !== AppealStatus.UNDER_REVIEW
      ) {
        throw new AppealConflictError("This appeal has already been resolved");
      }
      if (recommendation.recommendedScore > appeal.evaluation.maxScore) {
        throw new AppealValidationError(
          `AI recommended score cannot exceed ${appeal.evaluation.maxScore}`,
        );
      }

      let resultEvaluationId = appeal.resultEvaluationId;
      if (recommendation.decision === AppealStatus.ACCEPTED) {
        await manager
          .getRepository(Evaluation)
          .createQueryBuilder()
          .update(Evaluation)
          .set({ isFinal: false })
          .where("submissionId = :submissionId", {
            submissionId: appeal.submissionId,
          })
          .execute();
        const evaluation = await manager.getRepository(Evaluation).save(
          manager.getRepository(Evaluation).create({
            submissionId: appeal.submissionId,
            questionSetId: appeal.evaluation.questionSetId,
            score: recommendation.recommendedScore,
            maxScore: appeal.evaluation.maxScore,
            feedback: recommendation.resolution,
            selectionSummary: "AI appeal review",
            model,
            promptVersion: "appeal-v1",
            confidence: recommendation.confidence,
            status: EvaluationStatus.COMPLETED,
            isFinal: true,
            completedAt: new Date(),
          }),
        );
        resultEvaluationId = evaluation.id;
        updatedEvaluationId = evaluation.id;
      }

      appeal.status = recommendation.decision as
        | AppealStatus.ACCEPTED
        | AppealStatus.REJECTED;
      appeal.resultEvaluationId = resultEvaluationId;
      appeal.resolution = recommendation.resolution;
      appeal.reviewSource = AppealReviewSource.AI;
      appeal.aiRecommendation = recommendation;
      appeal.aiModel = model;
      appeal.aiReviewedAt = new Date();
      appeal.resolvedAt = new Date();
      await manager.getRepository(Appeal).save(appeal);
    });
    if (updatedEvaluationId) {
      await evaluationRealtime.publishEvaluation(updatedEvaluationId);
    }
    return (await this.findAppealById(appealId))!;
  }

  async assertLecturerCanReview(
    appealId: string,
    lecturerId: string,
  ): Promise<Appeal> {
    const appeal = await this.findAppealById(appealId);
    if (!appeal) throw new AppealNotFoundError(appealId);
    await this.assertLecturerForCourse(
      lecturerId,
      appeal.submission.assignment.courseId,
      this.dataSource.manager,
    );
    if (appeal.reviewerId && appeal.reviewerId !== lecturerId) {
      throw new AppealConflictError(
        "This appeal is assigned to another lecturer",
      );
    }
    return appeal;
  }

  private async assertLecturerForCourse(
    lecturerId: string,
    courseId: string,
    manager: EntityManager,
  ): Promise<void> {
    const lecturer = await manager.getRepository(Lecturer).findOne({
      where: { userId: lecturerId },
    });
    if (!lecturer) throw new AppealLecturerNotFoundError(lecturerId);
    const membership = await manager.getRepository(CourseLecturer).findOne({
      where: { courseId, lecturerId },
    });
    if (!membership) {
      throw new AppealForbiddenError(
        "Only lecturers assigned to this course may review the appeal",
      );
    }
  }
}
