import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  Repository,
} from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { AppealFile } from "../entities/appeal-file.js";
import { Appeal } from "../entities/appeal.js";
import { Assignment } from "../entities/assignment.js";
import { CourseLecturer } from "../entities/course-lecturer.js";
import {
  AppealStatus,
  EvaluationStatus,
  NotificationCategory,
  SubmissionStatus,
} from "../entities/enums.js";
import { Evaluation } from "../entities/evaluation.js";
import { FileAsset } from "../entities/file-asset.js";
import { Lecturer } from "../entities/lecturer.js";
import { Notification } from "../entities/notification.js";
import { Student } from "../entities/student.js";
import { Submission } from "../entities/submission.js";
import { evaluationRealtime } from "../realtime/evaluation-realtime.js";

export const APPEAL_CATEGORIES = [
  "grading_error",
  "misunderstanding",
  "technical",
  "other",
] as const;
export type AppealCategory = (typeof APPEAL_CATEGORIES)[number];

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

export class AppealValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppealValidationError";
  }
}

export class AppealForbiddenError extends Error {
  constructor(message = "You are not allowed to access this appeal") {
    super(message);
    this.name = "AppealForbiddenError";
  }
}

export class AppealConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppealConflictError";
  }
}

export const selectAppealableEvaluation = (input: {
  submissionStatus: SubmissionStatus;
  submissionStudentId: string;
  actorStudentId: string;
  hasExistingAppeal: boolean;
  evaluations: Evaluation[];
}): Evaluation => {
  if (input.submissionStudentId !== input.actorStudentId) {
    throw new AppealForbiddenError(
      "Students may only appeal their own submissions",
    );
  }
  if (input.submissionStatus !== SubmissionStatus.SUBMITTED) {
    throw new AppealValidationError(
      "Only submitted and graded work can be appealed",
    );
  }
  if (input.hasExistingAppeal) {
    throw new AppealConflictError(
      "An appeal already exists for this submission",
    );
  }

  const evaluation = input.evaluations
    .filter(
      (item) =>
        item.status === EvaluationStatus.COMPLETED &&
        item.isFinal &&
        item.score !== null,
    )
    .sort(
      (a, b) =>
        (b.completedAt?.getTime() ?? b.createdAt.getTime()) -
        (a.completedAt?.getTime() ?? a.createdAt.getTime()),
    )[0];
  if (!evaluation) {
    throw new AppealValidationError(
      "A completed final evaluation is required before appealing",
    );
  }
  return evaluation;
};

export const getAppealClaimAction = (
  appeal: Pick<Appeal, "status" | "reviewerId">,
  lecturerId: string,
): "CLAIM" | "ALREADY_CLAIMED" => {
  if (
    appeal.status === AppealStatus.UNDER_REVIEW &&
    appeal.reviewerId === lecturerId
  ) {
    return "ALREADY_CLAIMED";
  }
  if (appeal.status !== AppealStatus.SUBMITTED) {
    throw new AppealConflictError("Only submitted appeals can be claimed");
  }
  if (appeal.reviewerId && appeal.reviewerId !== lecturerId) {
    throw new AppealConflictError(
      "This appeal is assigned to another lecturer",
    );
  }
  return "CLAIM";
};

export const assertAppealCanBeResolved = (
  appeal: Pick<Appeal, "status" | "reviewerId">,
  lecturerId: string,
): void => {
  if (
    appeal.status !== AppealStatus.UNDER_REVIEW ||
    appeal.reviewerId !== lecturerId
  ) {
    throw new AppealConflictError(
      "The appeal must be claimed by this lecturer before it can be resolved",
    );
  }
};

export const validateRevisedScore = (
  status: AppealStatus.ACCEPTED | AppealStatus.REJECTED,
  newScore: number | undefined,
  maxScore: number,
): void => {
  if (status !== AppealStatus.ACCEPTED) return;
  if (newScore === undefined || !Number.isFinite(newScore)) {
    throw new AppealValidationError(
      "A revised score is required when accepting an appeal",
    );
  }
  if (newScore < 0 || newScore > maxScore) {
    throw new AppealValidationError(
      `newScore must be between 0 and ${maxScore}`,
    );
  }
};

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

export interface CreateAppealInput {
  submissionId: string;
  studentId: string;
  reason: string;
  category?: AppealCategory | null;
  fileId?: string;
}

export interface ResolveAppealInput {
  status: AppealStatus.ACCEPTED | AppealStatus.REJECTED;
  resolution: string;
  reviewerId: string;
  newScore?: number;
}

const fullAppealRelations = {
  student: { user: true },
  submission: {
    assignment: { course: true },
    files: { file: true },
  },
  evaluation: true,
  resultEvaluation: true,
  reviewer: { user: true },
  files: { file: true },
} as const;

export class AppealRepository {
  private readonly appealRepo: Repository<Appeal>;
  private readonly studentRepo: Repository<Student>;
  private readonly lecturerRepo: Repository<Lecturer>;

  constructor(private readonly dataSource: DataSource = AppDataSource) {
    this.appealRepo = dataSource.getRepository(Appeal);
    this.studentRepo = dataSource.getRepository(Student);
    this.lecturerRepo = dataSource.getRepository(Lecturer);
  }

  async createAppeal(input: CreateAppealInput): Promise<Appeal> {
    const reason = input.reason.trim();
    if (reason.length < 20 || reason.length > 5000) {
      throw new AppealValidationError(
        "reason must contain between 20 and 5000 characters",
      );
    }
    if (
      input.category &&
      !APPEAL_CATEGORIES.includes(input.category)
    ) {
      throw new AppealValidationError("Invalid appeal category");
    }

    return this.dataSource.transaction(async (manager) => {
      const submission = await manager.getRepository(Submission).findOne({
        where: { id: input.submissionId },
        lock: { mode: "pessimistic_write" },
      });

      if (!submission) {
        throw new AppealValidationError("Submission was not found");
      }
      const assignment = await manager.getRepository(Assignment).findOne({
        where: { id: submission.assignmentId },
        relations: { course: { lecturers: true } },
      });
      if (!assignment) {
        throw new AppealValidationError("Submission assignment was not found");
      }
      const evaluations = await manager.getRepository(Evaluation).find({
        where: { submissionId: submission.id },
      });
      const evaluation = selectAppealableEvaluation({
        submissionStatus: submission.status,
        submissionStudentId: submission.studentId,
        actorStudentId: input.studentId,
        hasExistingAppeal: await manager
          .getRepository(Appeal)
          .existsBy({ submissionId: submission.id }),
        evaluations,
      });

      if (
        input.fileId &&
        !(await manager.getRepository(FileAsset).existsBy({ id: input.fileId }))
      ) {
        throw new AppealValidationError("Evidence file was not found");
      }

      const appeal = await manager.getRepository(Appeal).save(
        manager.getRepository(Appeal).create({
          submissionId: submission.id,
          evaluationId: evaluation.id,
          resultEvaluationId: null,
          studentId: input.studentId,
          reviewerId: null,
          reason,
          category: input.category ?? null,
          status: AppealStatus.SUBMITTED,
          resolution: null,
          resolvedAt: null,
        }),
      );

      if (input.fileId) {
        await manager.getRepository(AppealFile).save(
          manager.getRepository(AppealFile).create({
            appealId: appeal.id,
            fileId: input.fileId,
          }),
        );
      }

      const notificationMetadata = {
        appealId: appeal.id,
        assignmentId: submission.assignmentId,
        courseId: assignment.courseId,
        studentId: input.studentId,
        status: appeal.status,
      };
      await this.createNotifications(manager, [input.studentId], {
        title: "Appeal received",
        body: `Your appeal for ${assignment.name} was received.`,
        link: `/student/assignments/${submission.assignmentId}`,
        metadata: notificationMetadata,
      });
      await this.createNotifications(
        manager,
        assignment.course.lecturers.map((item) => item.lecturerId),
        {
          title: "New grade appeal",
          body: `A student submitted an appeal for ${assignment.name}.`,
          link: `/lecturer/appeals/${appeal.id}`,
          metadata: notificationMetadata,
        },
      );

      return manager.getRepository(Appeal).findOneOrFail({
        where: { id: appeal.id },
        relations: fullAppealRelations,
      });
    });
  }

  async claimAppeal(appealId: string, lecturerId: string): Promise<Appeal> {
    await this.dataSource.transaction(async (manager) => {
      const appeal = await manager.getRepository(Appeal).findOne({
        where: { id: appealId },
        lock: { mode: "pessimistic_write" },
      });
      if (!appeal) throw new AppealNotFoundError(appealId);

      const submission = await manager.getRepository(Submission).findOne({
        where: { id: appeal.submissionId },
        relations: { assignment: true },
      });
      if (!submission) throw new AppealNotFoundError(appealId);
      await this.assertLecturerForCourse(
        lecturerId,
        submission.assignment.courseId,
        manager,
      );

      if (getAppealClaimAction(appeal, lecturerId) === "ALREADY_CLAIMED") {
        return;
      }

      appeal.status = AppealStatus.UNDER_REVIEW;
      appeal.reviewerId = lecturerId;
      await manager.getRepository(Appeal).save(appeal);
      await this.createNotifications(manager, [appeal.studentId], {
        title: "Appeal under review",
        body: `Your appeal for ${submission.assignment.name} is being reviewed.`,
        link: `/student/assignments/${submission.assignmentId}`,
        metadata: {
          appealId: appeal.id,
          assignmentId: submission.assignmentId,
          courseId: submission.assignment.courseId,
          status: appeal.status,
          reviewerId: lecturerId,
        },
      });
    });

    return (await this.findAppealById(appealId))!;
  }

  async resolveAppeal(
    appealId: string,
    input: ResolveAppealInput,
  ): Promise<Appeal> {
    const resolution = input.resolution.trim();
    if (!resolution || resolution.length > 5000) {
      throw new AppealValidationError(
        "A resolution of at most 5000 characters is required",
      );
    }

    let updatedEvaluationId: string | undefined;
    const resolvedAppealId = await this.dataSource.transaction(
      async (manager) => {
        const appealRepo = manager.getRepository(Appeal);
        const appeal = await appealRepo.findOne({
          where: { id: appealId },
          lock: { mode: "pessimistic_write" },
        });
        if (!appeal) throw new AppealNotFoundError(appealId);

        const submission = await manager.getRepository(Submission).findOne({
          where: { id: appeal.submissionId },
          relations: { assignment: true },
        });
        const originalEvaluation = await manager
          .getRepository(Evaluation)
          .findOne({ where: { id: appeal.evaluationId } });
        if (!submission || !originalEvaluation) {
          throw new AppealValidationError("Appeal evaluation data is incomplete");
        }

        await this.assertLecturerForCourse(
          input.reviewerId,
          submission.assignment.courseId,
          manager,
        );
        assertAppealCanBeResolved(appeal, input.reviewerId);

        let resultEvaluationId: string | null = null;
        if (input.status === AppealStatus.ACCEPTED) {
          validateRevisedScore(
            input.status,
            input.newScore,
            originalEvaluation.maxScore,
          );

          await manager
            .getRepository(Evaluation)
            .createQueryBuilder()
            .update(Evaluation)
            .set({ isFinal: false })
            .where("submission_id = :submissionId", {
              submissionId: appeal.submissionId,
            })
            .andWhere("is_final = true")
            .execute();

          const now = new Date();
          const revisedEvaluation = await manager
            .getRepository(Evaluation)
            .save(
              manager.getRepository(Evaluation).create({
                submissionId: appeal.submissionId,
                questionSetId: originalEvaluation.questionSetId,
                score: input.newScore,
                maxScore: originalEvaluation.maxScore,
                feedback: resolution,
                selectionSummary:
                  "Grade revised following lecturer appeal review",
                model: "lecturer-manual-appeal-resolution",
                promptVersion: "appeal-v1",
                confidence: null,
                status: EvaluationStatus.COMPLETED,
                isFinal: true,
                attemptCount: 0,
                maxAttempts: originalEvaluation.maxAttempts,
                nextAttemptAt: null,
                startedAt: now,
                completedAt: now,
                errorMessage: null,
              }),
            );
          resultEvaluationId = revisedEvaluation.id;
          updatedEvaluationId = revisedEvaluation.id;
        }

        appeal.status = input.status;
        appeal.resolution = resolution;
        appeal.resultEvaluationId = resultEvaluationId;
        appeal.resolvedAt = new Date();
        await appealRepo.save(appeal);

        const accepted = input.status === AppealStatus.ACCEPTED;
        await this.createNotifications(manager, [appeal.studentId], {
          title: accepted ? "Appeal accepted" : "Appeal rejected",
          body: accepted
            ? `Your appeal for ${submission.assignment.name} was accepted. Your revised score is ${input.newScore}/${originalEvaluation.maxScore}.`
            : `Your appeal for ${submission.assignment.name} was rejected. The original grade remains unchanged.`,
          link: `/student/assignments/${submission.assignmentId}`,
          metadata: {
            appealId: appeal.id,
            assignmentId: submission.assignmentId,
            courseId: submission.assignment.courseId,
            status: appeal.status,
            resolution: appeal.resolution,
            newScore: accepted ? input.newScore : undefined,
          },
        });

        return appeal.id;
      },
    );

    if (updatedEvaluationId) {
      await evaluationRealtime.publishEvaluation(updatedEvaluationId);
    }
    return (await this.findAppealById(resolvedAppealId))!;
  }

  async findAppealsByStudentId(
    studentId: string,
    options?: StudentAppealsQueryOptions,
  ): Promise<Appeal[]> {
    if (!(await this.studentRepo.existsBy({ userId: studentId }))) {
      throw new AppealStudentNotFoundError(studentId);
    }

    const where: FindOptionsWhere<Appeal> = { studentId };
    if (options?.status) {
      const status = options.status.toUpperCase();
      if (status === "IN_PROGRESS" || status === "PENDING") {
        where.status = In([AppealStatus.SUBMITTED, AppealStatus.UNDER_REVIEW]);
      } else if (Object.values(AppealStatus).includes(status as AppealStatus)) {
        where.status = status as AppealStatus;
      }
    }
    return this.appealRepo.find({
      where,
      relations: fullAppealRelations,
      order: { createdAt: "DESC" },
      take: options?.limit && options.limit > 0 ? options.limit : undefined,
    });
  }

  async findAppealsByLecturerId(
    lecturerId: string,
    options?: LecturerAppealsQueryOptions,
  ): Promise<Appeal[]> {
    if (!(await this.lecturerRepo.existsBy({ userId: lecturerId }))) {
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
      const status = options.status.toUpperCase();
      if (status === "PENDING" || status === "IN_PROGRESS") {
        qb.andWhere("appeal.status IN (:...statuses)", {
          statuses: [AppealStatus.SUBMITTED, AppealStatus.UNDER_REVIEW],
        });
      } else if (status === "RESOLVED") {
        qb.andWhere("appeal.status IN (:...statuses)", {
          statuses: [
            AppealStatus.ACCEPTED,
            AppealStatus.REJECTED,
            AppealStatus.CANCELLED,
          ],
        });
      } else if (Object.values(AppealStatus).includes(status as AppealStatus)) {
        qb.andWhere("appeal.status = :status", { status });
      }
    }
    if (options?.search?.trim()) {
      qb.andWhere(
        "(LOWER(user.name) LIKE LOWER(:search) OR CAST(student.userId AS TEXT) LIKE :search)",
        { search: `%${options.search.trim()}%` },
      );
    }
    qb.orderBy("appeal.createdAt", "DESC");
    if (options?.limit && options.limit > 0) qb.take(options.limit);
    return qb.getMany();
  }

  async getLecturerAppealsStats(
    lecturerId: string,
  ): Promise<LecturerAppealsStatsResult> {
    if (!(await this.lecturerRepo.existsBy({ userId: lecturerId }))) {
      throw new AppealLecturerNotFoundError(lecturerId);
    }
    const rows: { status: AppealStatus; count: string }[] =
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

    return rows.reduce<LecturerAppealsStatsResult>(
      (stats, row) => {
        const count = Number.parseInt(row.count, 10) || 0;
        stats.totalCount += count;
        if (
          row.status === AppealStatus.SUBMITTED ||
          row.status === AppealStatus.UNDER_REVIEW
        ) {
          stats.pendingCount += count;
        } else {
          stats.resolvedCount += count;
        }
        return stats;
      },
      { pendingCount: 0, resolvedCount: 0, totalCount: 0 },
    );
  }

  async findAppealById(appealId: string): Promise<Appeal | null> {
    return this.appealRepo.findOne({
      where: { id: appealId },
      relations: fullAppealRelations,
    });
  }

  async findEvidence(
    appealId: string,
    fileId: string,
  ): Promise<AppealFile | null> {
    return this.dataSource.getRepository(AppealFile).findOne({
      where: { appealId, fileId },
      relations: { file: true },
    });
  }

  async isLecturerForCourse(
    lecturerId: string,
    courseId: string,
  ): Promise<boolean> {
    return this.dataSource.getRepository(CourseLecturer).existsBy({
      lecturerId,
      courseId,
    });
  }

  private async assertLecturerForCourse(
    lecturerId: string,
    courseId: string,
    manager: EntityManager,
  ): Promise<void> {
    if (!(await manager.getRepository(Lecturer).existsBy({ userId: lecturerId }))) {
      throw new AppealLecturerNotFoundError(lecturerId);
    }
    if (
      !(await manager.getRepository(CourseLecturer).existsBy({
        lecturerId,
        courseId,
      }))
    ) {
      throw new AppealForbiddenError(
        "Only lecturers assigned to this course may review the appeal",
      );
    }
  }

  private async createNotifications(
    manager: EntityManager,
    recipientIds: string[],
    data: {
      title: string;
      body: string;
      link: string;
      metadata: Record<string, unknown>;
    },
  ): Promise<void> {
    const recipients = [...new Set(recipientIds)];
    if (recipients.length === 0) return;
    const repository = manager.getRepository(Notification);
    await repository.save(
      recipients.map((recipientId) =>
        repository.create({
          recipientId,
          title: data.title,
          body: data.body,
          category: NotificationCategory.APPEAL,
          isRead: false,
          link: data.link,
          metadata: data.metadata,
          readAt: null,
        }),
      ),
    );
  }
}
