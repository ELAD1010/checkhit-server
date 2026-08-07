import { DataSource, EntityManager, IsNull, LessThanOrEqual } from "typeorm";
import { getGradingConfig } from "../config/grading.config.js";
import { AppDataSource } from "../database/data-source.js";
import { Evaluation } from "../entities/evaluation.js";
import { EvaluationAudit } from "../entities/evaluation-audit.js";
import { EvaluationQuestionResult } from "../entities/evaluation-question-result.js";
import { EvaluationStatus } from "../entities/enums.js";
import { Submission } from "../entities/submission.js";
import { SubmissionNotFoundError } from "./submission.repository.js";

export type CreateEvaluationInput = {
  submissionId: string;
  questionSetId: string;
  maxScore: number;
  model: string;
  promptVersion: string;
  maxAttempts?: number;
};

export type PersistCompletedEvaluationInput = {
  evaluationId: string;
  score: number;
  maxScore: number;
  feedback: string;
  selectionSummary: string;
  confidence: number | null;
  questionResults: Array<{
    questionId: string;
    score: number;
    maxScore: number;
    isAnswered: boolean;
    countsTowardTotal: boolean;
    selectionReason: string;
    feedback: string;
    evidence: string | null;
    confidence: number | null;
  }>;
  audit: {
    requestPayload: Record<string, unknown> | null;
    rawResponse: Record<string, unknown> | null;
    providerRequestId: string | null;
    tokenUsage: Record<string, unknown> | null;
    latencyMs: number | null;
    validationErrors: Record<string, unknown> | null;
  };
};

export class EvaluationNotFoundError extends Error {
  constructor(readonly evaluationId: string) {
    super(`Evaluation not found: ${evaluationId}`);
    this.name = "EvaluationNotFoundError";
  }
}

export class EvaluationRepository {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  async createPending(input: CreateEvaluationInput): Promise<Evaluation> {
    return this.dataSource.transaction(async (manager) => {
      const submission = await manager.getRepository(Submission).findOne({
        where: { id: input.submissionId },
        lock: { mode: "pessimistic_write" },
      });

      if (!submission) {
        throw new SubmissionNotFoundError(input.submissionId);
      }

      const repository = manager.getRepository(Evaluation);
      const existing = await repository.findOne({
        where: [
          {
            submissionId: input.submissionId,
            status: EvaluationStatus.PENDING,
          },
          {
            submissionId: input.submissionId,
            status: EvaluationStatus.PROCESSING,
          },
        ],
        order: { createdAt: "DESC" },
      });
      if (existing) {
        return existing;
      }

      return repository.save(
        repository.create({
          submissionId: input.submissionId,
          questionSetId: input.questionSetId,
          score: null,
          maxScore: input.maxScore,
          feedback: null,
          selectionSummary: null,
          model: input.model,
          promptVersion: input.promptVersion,
          confidence: null,
          status: EvaluationStatus.PENDING,
          isFinal: false,
          attemptCount: 0,
          maxAttempts:
            input.maxAttempts ?? getGradingConfig().workerMaxAttempts,
          nextAttemptAt: new Date(),
          startedAt: null,
          completedAt: null,
          errorMessage: null,
        }),
      );
    });
  }

  async findPendingBySubmissionId(
    submissionId: string,
  ): Promise<Evaluation | null> {
    return this.dataSource.getRepository(Evaluation).findOne({
      where: [
        { submissionId, status: EvaluationStatus.PENDING },
        { submissionId, status: EvaluationStatus.PROCESSING },
      ],
      order: { createdAt: "DESC" },
    });
  }

  async findById(
    evaluationId: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Evaluation | null> {
    return manager.getRepository(Evaluation).findOne({
      where: { id: evaluationId },
      relations: {
        questionResults: {
          question: true,
        },
        submission: {
          assignment: true,
          files: {
            file: true,
          },
        },
      },
      order: {
        questionResults: {
          question: {
            orderIndex: "ASC",
          },
        },
      },
    });
  }

  async takeNextPending(): Promise<Evaluation | null> {
    const now = new Date();
    const repository = this.dataSource.getRepository(Evaluation);
    const evaluation = await repository.findOne({
      where: {
        status: EvaluationStatus.PENDING,
        nextAttemptAt: LessThanOrEqual(now),
      },
      order: { createdAt: "ASC" },
    });

    if (!evaluation) {
      return null;
    }

    evaluation.status = EvaluationStatus.PROCESSING;
    evaluation.startedAt ??= now;
    evaluation.attemptCount += 1;
    await repository.save(evaluation);
    return evaluation;
  }

  async recoverInterruptedJobs(): Promise<void> {
    const repository = this.dataSource.getRepository(Evaluation);
    const interrupted = await repository.findBy({
      status: EvaluationStatus.PROCESSING,
    });

    for (const evaluation of interrupted) {
      const canRetry = evaluation.attemptCount < evaluation.maxAttempts;
      evaluation.status = canRetry
        ? EvaluationStatus.PENDING
        : EvaluationStatus.FAILED;
      evaluation.nextAttemptAt = canRetry ? new Date() : null;
      evaluation.completedAt = canRetry ? null : new Date();
      evaluation.errorMessage = canRetry
        ? null
        : "Evaluation was interrupted before completion";
    }

    if (interrupted.length > 0) {
      await repository.save(interrupted);
    }
  }

  async persistCompleted(
    input: PersistCompletedEvaluationInput,
  ): Promise<Evaluation> {
    return this.dataSource.transaction(async (manager) => {
      const evaluation = await manager.getRepository(Evaluation).findOne({
        where: {
          id: input.evaluationId,
          status: EvaluationStatus.PROCESSING,
        },
      });

      if (!evaluation) {
        throw new EvaluationNotFoundError(input.evaluationId);
      }

      await manager
        .getRepository(Evaluation)
        .createQueryBuilder()
        .update(Evaluation)
        .set({ isFinal: false })
        .where("submission_id = :submissionId", {
          submissionId: evaluation.submissionId,
        })
        .andWhere("evaluation_id <> :evaluationId", {
          evaluationId: evaluation.id,
        })
        .andWhere("is_final = true")
        .execute();

      evaluation.score = input.score;
      evaluation.maxScore = input.maxScore;
      evaluation.feedback = input.feedback;
      evaluation.selectionSummary = input.selectionSummary;
      evaluation.confidence = input.confidence;
      evaluation.status = EvaluationStatus.COMPLETED;
      evaluation.isFinal = true;
      evaluation.errorMessage = null;
      evaluation.nextAttemptAt = null;
      evaluation.completedAt = new Date();
      await manager.getRepository(Evaluation).save(evaluation);

      await manager.getRepository(EvaluationQuestionResult).delete({
        evaluationId: evaluation.id,
      });

      const resultRepository = manager.getRepository(EvaluationQuestionResult);
      await resultRepository.save(
        input.questionResults.map((result) =>
          resultRepository.create({
            evaluationId: evaluation.id,
            questionId: result.questionId,
            score: result.score,
            maxScore: result.maxScore,
            isAnswered: result.isAnswered,
            countsTowardTotal: result.countsTowardTotal,
            selectionReason: result.selectionReason,
            feedback: result.feedback,
            evidence: result.evidence,
            confidence: result.confidence,
          }),
        ),
      );

      const auditRepository = manager.getRepository(EvaluationAudit);
      const existingAudit = await auditRepository.findOne({
        where: { evaluationId: evaluation.id },
      });

      if (existingAudit) {
        existingAudit.requestPayload = input.audit.requestPayload;
        existingAudit.rawResponse = input.audit.rawResponse;
        existingAudit.providerRequestId = input.audit.providerRequestId;
        existingAudit.tokenUsage = input.audit.tokenUsage;
        existingAudit.latencyMs = input.audit.latencyMs;
        existingAudit.validationErrors = input.audit.validationErrors;
        await auditRepository.save(existingAudit);
      } else {
        await auditRepository.save(
          auditRepository.create({
            evaluationId: evaluation.id,
            requestPayload: input.audit.requestPayload,
            rawResponse: input.audit.rawResponse,
            providerRequestId: input.audit.providerRequestId,
            tokenUsage: input.audit.tokenUsage,
            latencyMs: input.audit.latencyMs,
            validationErrors: input.audit.validationErrors,
          }),
        );
      }

      return this.findById(evaluation.id, manager) as Promise<Evaluation>;
    });
  }

  async markFailedOrRetry(
    evaluation: Evaluation,
    errorMessage: string,
    validationErrors: Record<string, unknown> | null = null,
    auditPartial?: {
      requestPayload?: Record<string, unknown> | null;
      rawResponse?: Record<string, unknown> | null;
      providerRequestId?: string | null;
      tokenUsage?: Record<string, unknown> | null;
      latencyMs?: number | null;
    },
  ): Promise<void> {
    const canRetry = evaluation.attemptCount < evaluation.maxAttempts;
    const delayMs = Math.min(
      60_000,
      2 ** Math.max(0, evaluation.attemptCount - 1) * 2000,
    );

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Evaluation).update(
        {
          id: evaluation.id,
          status: EvaluationStatus.PROCESSING,
        },
        {
          status: canRetry ? EvaluationStatus.PENDING : EvaluationStatus.FAILED,
          errorMessage,
          nextAttemptAt: canRetry ? new Date(Date.now() + delayMs) : null,
          completedAt: canRetry ? null : new Date(),
        },
      );

      if (auditPartial || validationErrors) {
        const auditRepository = manager.getRepository(EvaluationAudit);
        const existing = await auditRepository.findOne({
          where: { evaluationId: evaluation.id },
        });

        const payload = {
          requestPayload: auditPartial?.requestPayload ?? null,
          rawResponse: auditPartial?.rawResponse ?? null,
          providerRequestId: auditPartial?.providerRequestId ?? null,
          tokenUsage: auditPartial?.tokenUsage ?? null,
          latencyMs: auditPartial?.latencyMs ?? null,
          validationErrors,
        };

        if (existing) {
          Object.assign(existing, payload);
          await auditRepository.save(existing);
        } else {
          await auditRepository.save(
            auditRepository.create({
              evaluationId: evaluation.id,
              ...payload,
            }),
          );
        }
      }
    });
  }
}
