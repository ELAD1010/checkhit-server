import {
  DataSource,
  EntityManager,
  IsNull,
  LessThanOrEqual,
  MoreThan,
  Not,
} from "typeorm";
import { getGradingConfig } from "../config/grading.config.js";
import { AppDataSource } from "../database/data-source.js";
import { Assignment } from "../entities/assignment.js";
import { AssignmentQuestionImport } from "../entities/assignment-question-import.js";
import { AssignmentQuestion } from "../entities/assignment-question.js";
import { QuestionImportStatus } from "../entities/enums.js";
import { FileAsset } from "../entities/file-asset.js";
import { AssignmentNotFoundError } from "./assignment-question.repository.js";

export type CreateQuestionImportInput = {
  assignmentId: string;
  fileId: string;
  model: string;
  promptVersion: string;
  maxAttempts?: number;
};

export class QuestionImportRepository {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  async createImport(
    input: CreateQuestionImportInput,
  ): Promise<AssignmentQuestionImport> {
    return this.dataSource.transaction(async (manager) => {
      const assignment = await manager.getRepository(Assignment).findOne({
        where: { id: input.assignmentId },
        lock: { mode: "pessimistic_write" },
      });
      if (!assignment) {
        throw new AssignmentNotFoundError(input.assignmentId);
      }

      const fileExists = await manager
        .getRepository(FileAsset)
        .existsBy({ id: input.fileId });
      if (!fileExists) {
        throw new Error(`File asset not found: ${input.fileId}`);
      }

      const repository = manager.getRepository(AssignmentQuestionImport);
      return repository.save(
        repository.create({
          assignmentId: input.assignmentId,
          fileId: input.fileId,
          model: input.model,
          promptVersion: input.promptVersion,
          status: QuestionImportStatus.PENDING,
          attemptCount: 0,
          maxAttempts:
            input.maxAttempts ?? getGradingConfig().workerMaxAttempts,
          nextAttemptAt: new Date(),
          startedAt: null,
          completedAt: null,
          errorMessage: null,
          rawResponse: null,
        }),
      );
    });
  }

  async findById(importId: string): Promise<AssignmentQuestionImport | null> {
    return this.dataSource.getRepository(AssignmentQuestionImport).findOne({
      where: { id: importId },
      relations: {
        file: true,
        assignment: true,
        questions: true,
      },
      order: {
        questions: {
          orderIndex: "ASC",
        },
      },
    });
  }

  async isSuperseded(
    questionImport: AssignmentQuestionImport,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<boolean> {
    const [newerImportExists, newerQuestionExists] = await Promise.all([
      manager.getRepository(AssignmentQuestionImport).existsBy({
        id: Not(questionImport.id),
        assignmentId: questionImport.assignmentId,
        createdAt: MoreThan(questionImport.createdAt),
      }),
      manager.getRepository(AssignmentQuestion).existsBy({
        assignmentId: questionImport.assignmentId,
        isActive: true,
        updatedAt: MoreThan(questionImport.createdAt),
      }),
    ]);

    return newerImportExists || newerQuestionExists;
  }

  async takeNextPending(): Promise<AssignmentQuestionImport | null> {
    const now = new Date();
    const repository = this.dataSource.getRepository(AssignmentQuestionImport);
    const questionImport = await repository.findOne({
      where: {
        status: QuestionImportStatus.PENDING,
        nextAttemptAt: LessThanOrEqual(now),
      },
      order: { createdAt: "ASC" },
      relations: { file: true, assignment: true },
    });

    if (!questionImport) {
      return null;
    }

    questionImport.status = QuestionImportStatus.PROCESSING;
    questionImport.startedAt ??= now;
    questionImport.attemptCount += 1;
    return repository.save(questionImport);
  }

  async recoverInterruptedJobs(): Promise<void> {
    const repository = this.dataSource.getRepository(AssignmentQuestionImport);
    const interrupted = await repository.findBy({
      status: QuestionImportStatus.PROCESSING,
    });

    for (const questionImport of interrupted) {
      const canRetry = questionImport.attemptCount < questionImport.maxAttempts;
      questionImport.status = canRetry
        ? QuestionImportStatus.PENDING
        : QuestionImportStatus.FAILED;
      questionImport.nextAttemptAt = canRetry ? new Date() : null;
      questionImport.completedAt = canRetry ? null : new Date();
      questionImport.errorMessage = canRetry
        ? null
        : "Question import was interrupted before completion";
    }

    if (interrupted.length > 0) {
      await repository.save(interrupted);
    }
  }

  async markCompleted(
    importId: string,
    rawResponse: Record<string, unknown>,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<void> {
    const repository = manager.getRepository(AssignmentQuestionImport);
    const questionImport = await repository.findOne({
      where: {
        id: importId,
        status: QuestionImportStatus.PROCESSING,
      },
    });
    if (!questionImport) {
      throw new Error(`Question import not found: ${importId}`);
    }

    questionImport.status = QuestionImportStatus.COMPLETED;
    questionImport.rawResponse = rawResponse;
    questionImport.completedAt = new Date();
    questionImport.errorMessage = null;
    questionImport.nextAttemptAt = null;
    await repository.save(questionImport);
  }

  async markFailedOrRetry(
    questionImport: AssignmentQuestionImport,
    errorMessage: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<void> {
    const canRetry = questionImport.attemptCount < questionImport.maxAttempts;
    const delayMs = Math.min(
      60_000,
      2 ** Math.max(0, questionImport.attemptCount - 1) * 2000,
    );

    await manager.getRepository(AssignmentQuestionImport).update(
      {
        id: questionImport.id,
        status: QuestionImportStatus.PROCESSING,
      },
      {
        status: canRetry
          ? QuestionImportStatus.PENDING
          : QuestionImportStatus.FAILED,
        errorMessage,
        nextAttemptAt: canRetry ? new Date(Date.now() + delayMs) : null,
        completedAt: canRetry ? null : new Date(),
      },
    );
  }

  async markSuperseded(
    importId: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<void> {
    await manager.getRepository(AssignmentQuestionImport).update(
      {
        id: importId,
        status: QuestionImportStatus.PROCESSING,
      },
      {
        status: QuestionImportStatus.SUPERSEDED,
        errorMessage: null,
        nextAttemptAt: null,
        completedAt: new Date(),
      },
    );
  }
}
