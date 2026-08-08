import { DataSource, EntityManager, In } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { Assignment } from "../entities/assignment.js";
import { SubmissionStatus } from "../entities/enums.js";
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

export class SubmissionRepository {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  async createSubmission(input: CreateSubmissionInput): Promise<Submission> {
    return this.dataSource.transaction(async (manager) => {
      const assignment = await manager.getRepository(Assignment).findOne({
        where: { id: input.assignmentId },
      });

      if (!assignment) {
        throw new AssignmentNotFoundError(input.assignmentId);
      }

      const studentExists = await manager
        .getRepository(Student)
        .existsBy({ userId: input.studentId });

      if (!studentExists) {
        throw new StudentNotFoundError(input.studentId);
      }

      const latest = await manager.getRepository(Submission).findOne({
        where: {
          assignmentId: input.assignmentId,
          studentId: input.studentId,
        },
        order: { attemptNumber: "DESC" },
      });

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
      });

      if (!submission) {
        throw new SubmissionNotFoundError(submissionId);
      }

      if (submission.status === SubmissionStatus.SUBMITTED) {
        throw new SubmissionAlreadySubmittedError(submissionId);
      }

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
      });

      if (!submission) {
        throw new SubmissionNotFoundError(submissionId);
      }

      if (submission.status !== SubmissionStatus.DRAFT) {
        throw new SubmissionAlreadySubmittedError(submissionId);
      }

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
