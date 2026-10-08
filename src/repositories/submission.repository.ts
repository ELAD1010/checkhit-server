import { DataSource, EntityManager, In } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { Appeal } from "../entities/appeal.js";
import { Assignment } from "../entities/assignment.js";
import {
  AppealStatus,
  AssignmentStatus,
  EvaluationStatus,
  SubmissionStatus,
} from "../entities/enums.js";
import { Evaluation } from "../entities/evaluation.js";
import { FileAsset } from "../entities/file-asset.js";
import { Student } from "../entities/student.js";
import { Submission } from "../entities/submission.js";
import { SubmissionFile } from "../entities/submission-file.js";
import { AssignmentNotFoundError } from "./assignment-question.repository.js";

export type CreateSubmissionInput = {
  assignmentId: string;
  studentId: string;
  answerText?: string | null;
  fileIds?: string[];
  submit?: boolean;
};

export type UpdateDraftSubmissionInput = {
  answerText?: string | null;
  fileIds?: string[];
};

export class StudentNotFoundError extends Error {
  constructor(readonly studentId: string) {
    super(`Student not found: ${studentId}`);
    this.name = "StudentNotFoundError";
  }
}

export class SubmissionNotFoundError extends Error {
  constructor(readonly submissionId: string) {
    super(`Submission not found: ${submissionId}`);
    this.name = "SubmissionNotFoundError";
  }
}

export class SubmissionAlreadySubmittedError extends Error {
  constructor(readonly submissionId: string) {
    super(`Submission already submitted: ${submissionId}`);
    this.name = "SubmissionAlreadySubmittedError";
  }
}

export type SubmissionRejectionCode =
  | "ASSIGNMENT_CLOSED"
  | "ASSIGNMENT_NOT_OPEN"
  | "DEADLINE_PASSED"
  | "APPEAL_IN_PROGRESS"
  | "DRAFT_EXISTS"
  | "GRADING_IN_PROGRESS";

const SUBMISSION_REJECTION_MESSAGES: Record<SubmissionRejectionCode, string> = {
  ASSIGNMENT_CLOSED: "This assignment is closed for submissions",
  ASSIGNMENT_NOT_OPEN: "This assignment is not open for submissions yet",
  DEADLINE_PASSED: "The submission deadline has passed",
  APPEAL_IN_PROGRESS:
    "An appeal for this assignment is still being reviewed",
  DRAFT_EXISTS:
    "A draft already exists for this assignment; update or submit it instead",
  GRADING_IN_PROGRESS: "The previous attempt is still being graded",
};

export class SubmissionRejectedError extends Error {
  constructor(readonly code: SubmissionRejectionCode) {
    super(SUBMISSION_REJECTION_MESSAGES[code]);
    this.name = "SubmissionRejectedError";
  }
}

const ACTIVE_APPEAL_STATUSES = [AppealStatus.SUBMITTED, AppealStatus.UNDER_REVIEW];
const SETTLED_EVALUATION_STATUSES = new Set([
  EvaluationStatus.COMPLETED,
  EvaluationStatus.FAILED,
]);

export const assertSubmissionWindowOpen = (
  assignment: Pick<Assignment, "status" | "startAt" | "dueAt">,
  now: Date = new Date(),
): void => {
  if (
    assignment.status === AssignmentStatus.CLOSED ||
    assignment.status === AssignmentStatus.ARCHIVED
  ) {
    throw new SubmissionRejectedError("ASSIGNMENT_CLOSED");
  }
  if (assignment.startAt && assignment.startAt.getTime() > now.getTime()) {
    throw new SubmissionRejectedError("ASSIGNMENT_NOT_OPEN");
  }
  if (assignment.dueAt && assignment.dueAt.getTime() <= now.getTime()) {
    throw new SubmissionRejectedError("DEADLINE_PASSED");
  }
};

export const assertNewAttemptAllowed = (
  latest:
    | (Pick<Submission, "status"> & {
        evaluations?: Array<Pick<Evaluation, "status">>;
      })
    | null,
): void => {
  if (!latest) return;
  if (latest.status === SubmissionStatus.DRAFT) {
    throw new SubmissionRejectedError("DRAFT_EXISTS");
  }
  const isSettled = (latest.evaluations ?? []).some((evaluation) =>
    SETTLED_EVALUATION_STATUSES.has(evaluation.status),
  );
  if (!isSettled) {
    throw new SubmissionRejectedError("GRADING_IN_PROGRESS");
  }
};

export class SubmissionRepository {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  private async assertNoActiveAppeal(
    manager: EntityManager,
    assignmentId: string,
    studentId: string,
  ): Promise<void> {
    const hasActiveAppeal = await manager
      .getRepository(Appeal)
      .createQueryBuilder("appeal")
      .innerJoin("appeal.submission", "submission")
      .where("appeal.studentId = :studentId", { studentId })
      .andWhere("submission.assignmentId = :assignmentId", { assignmentId })
      .andWhere("appeal.status IN (:...statuses)", {
        statuses: ACTIVE_APPEAL_STATUSES,
      })
      .getExists();
    if (hasActiveAppeal) {
      throw new SubmissionRejectedError("APPEAL_IN_PROGRESS");
    }
  }

  private async findAssignmentForSubmission(
    manager: EntityManager,
    assignmentId: string,
  ): Promise<Assignment> {
    const assignment = await manager.getRepository(Assignment).findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new AssignmentNotFoundError(assignmentId);
    }
    return assignment;
  }

  async createSubmission(input: CreateSubmissionInput): Promise<Submission> {
    return this.dataSource.transaction(async (manager) => {
      const assignment = await this.findAssignmentForSubmission(
        manager,
        input.assignmentId,
      );

      // Serializes concurrent attempts by the same student so attempt numbers
      // are computed from committed state.
      const student = await manager.getRepository(Student).findOne({
        where: { userId: input.studentId },
        lock: { mode: "pessimistic_write" },
      });

      if (!student) {
        throw new StudentNotFoundError(input.studentId);
      }

      assertSubmissionWindowOpen(assignment);

      const latest = await manager.getRepository(Submission).findOne({
        where: {
          assignmentId: input.assignmentId,
          studentId: input.studentId,
        },
        relations: { evaluations: true },
        order: { attemptNumber: "DESC" },
      });

      assertNewAttemptAllowed(latest);
      await this.assertNoActiveAppeal(
        manager,
        input.assignmentId,
        input.studentId,
      );

      const attemptNumber = (latest?.attemptNumber ?? 0) + 1;
      const submit = input.submit === true;
      const submissionRepository = manager.getRepository(Submission);
      const submission = await submissionRepository.save(
        submissionRepository.create({
          assignmentId: input.assignmentId,
          studentId: input.studentId,
          attemptNumber,
          answerText: input.answerText?.trim() || null,
          status: submit ? SubmissionStatus.SUBMITTED : SubmissionStatus.DRAFT,
          submittedAt: submit ? new Date() : null,
        }),
      );

      if (input.fileIds && input.fileIds.length > 0) {
        await this.attachFiles(manager, submission.id, input.fileIds);
      }

      return this.findById(submission.id, manager) as Promise<Submission>;
    });
  }

  async submitDraft(submissionId: string, studentId: string): Promise<Submission> {
    return this.dataSource.transaction(async (manager) => {
      const submission = await manager.getRepository(Submission).findOne({
        where: { id: submissionId, studentId },
        lock: { mode: "pessimistic_write" },
      });

      if (!submission) {
        throw new SubmissionNotFoundError(submissionId);
      }

      if (submission.status === SubmissionStatus.SUBMITTED) {
        throw new SubmissionAlreadySubmittedError(submissionId);
      }

      assertSubmissionWindowOpen(
        await this.findAssignmentForSubmission(manager, submission.assignmentId),
      );
      await this.assertNoActiveAppeal(
        manager,
        submission.assignmentId,
        studentId,
      );

      submission.status = SubmissionStatus.SUBMITTED;
      submission.submittedAt = new Date();
      await manager.getRepository(Submission).save(submission);

      return this.findById(submissionId, manager) as Promise<Submission>;
    });
  }

  async updateDraft(
    submissionId: string,
    studentId: string,
    input: UpdateDraftSubmissionInput,
  ): Promise<Submission> {
    return this.dataSource.transaction(async (manager) => {
      const submissionRepository = manager.getRepository(Submission);
      const submission = await submissionRepository.findOne({
        where: { id: submissionId, studentId },
        lock: { mode: "pessimistic_write" },
      });

      if (!submission) {
        throw new SubmissionNotFoundError(submissionId);
      }

      if (submission.status !== SubmissionStatus.DRAFT) {
        throw new SubmissionAlreadySubmittedError(submissionId);
      }

      assertSubmissionWindowOpen(
        await this.findAssignmentForSubmission(manager, submission.assignmentId),
      );
      await this.assertNoActiveAppeal(
        manager,
        submission.assignmentId,
        studentId,
      );

      if (input.answerText !== undefined) {
        submission.answerText = input.answerText?.trim() || null;
      }

      await submissionRepository.save(submission);

      if (input.fileIds !== undefined) {
        await manager.getRepository(SubmissionFile).delete({ submissionId });
        if (input.fileIds.length > 0) {
          await this.attachFiles(manager, submissionId, input.fileIds);
        }
      }

      return this.findById(submissionId, manager) as Promise<Submission>;
    });
  }

  async findById(
    submissionId: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Submission | null> {
    return manager.getRepository(Submission).findOne({
      where: { id: submissionId },
      relations: {
        files: {
          file: true,
        },
        assignment: true,
        evaluations: true,
      },
      order: {
        evaluations: {
          createdAt: "DESC",
        },
      },
    });
  }

  async listByAssignmentForStudent(
    assignmentId: string,
    studentId: string,
  ): Promise<Submission[]> {
    return this.dataSource.getRepository(Submission).find({
      where: { assignmentId, studentId },
      relations: {
        files: {
          file: true,
        },
        evaluations: true,
      },
      order: {
        attemptNumber: "DESC",
      },
    });
  }

  async listByAssignment(assignmentId: string): Promise<Submission[]> {
    return this.dataSource.getRepository(Submission).find({
      where: { assignmentId },
      relations: {
        files: {
          file: true,
        },
        evaluations: true,
      },
      order: {
        submittedAt: "DESC",
        createdAt: "DESC",
      },
    });
  }

  private async attachFiles(
    manager: EntityManager,
    submissionId: string,
    fileIds: string[],
  ): Promise<void> {
    const uniqueFileIds = [...new Set(fileIds)];
    const files = await manager.getRepository(FileAsset).findBy({
      id: In(uniqueFileIds),
    });

    if (files.length !== uniqueFileIds.length) {
      throw new Error("One or more file assets were not found");
    }

    const submissionFileRepository = manager.getRepository(SubmissionFile);
    await submissionFileRepository.save(
      uniqueFileIds.map((fileId) =>
        submissionFileRepository.create({
          submissionId,
          fileId,
        }),
      ),
    );
  }
}
