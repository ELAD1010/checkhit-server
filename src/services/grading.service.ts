import { getGradingConfig } from "../config/grading.config.js";
import { AppDataSource } from "../database/data-source.js";
import { Assignment } from "../entities/assignment.js";
import { QuestionSource } from "../entities/enums.js";
import type { Evaluation } from "../entities/evaluation.js";
import type { AssignmentQuestionImport } from "../entities/assignment-question-import.js";
import { AssignmentQuestionRepository } from "../repositories/assignment-question.repository.js";
import { EvaluationRepository } from "../repositories/evaluation.repository.js";
import { QuestionImportRepository } from "../repositories/question-import.repository.js";
import { extractDocumentContent } from "../storage/document-content.js";
import {
  LocalFileStorage,
  type FileStorage,
} from "../storage/local-file-storage.js";
import { PDF_MIME } from "../storage/upload-mime.js";
import {
  GeminiGradingProvider,
  type GradingAiProvider,
  type ProviderBinaryPart,
} from "../grading/gemini-provider.js";
import {
  DomainValidationError,
  validateExtractedQuestions,
  validateGradingAgainstQuestions,
} from "../grading/schemas.js";

export class GradingService {
  constructor(
    private readonly evaluationRepository = new EvaluationRepository(),
    private readonly questionRepository = new AssignmentQuestionRepository(),
    private readonly questionImportRepository = new QuestionImportRepository(),
    private readonly fileStorage: FileStorage = new LocalFileStorage(),
    private readonly aiProvider: GradingAiProvider | null = null,
  ) {}

  private getProvider(): GradingAiProvider {
    if (this.aiProvider) {
      return this.aiProvider;
    }

    return new GeminiGradingProvider();
  }

  async processEvaluation(evaluation: Evaluation): Promise<void> {
    const config = getGradingConfig();
    try {
      const fullEvaluation = await this.evaluationRepository.findById(
        evaluation.id,
      );

      if (!fullEvaluation?.submission?.assignment) {
        throw new Error(
          `Evaluation ${evaluation.id} is missing submission data`,
        );
      }

      const questions = await this.questionRepository.listByQuestionSetId(
        fullEvaluation.submission.assignmentId,
        fullEvaluation.questionSetId,
      );

      if (questions.length === 0) {
        throw new DomainValidationError(
          "Cannot grade a submission without assignment questions",
        );
      }

      const extractedFileTexts: Array<{ fileName: string; text: string }> = [];
      const pdfParts: ProviderBinaryPart[] = [];

      for (const link of fullEvaluation.submission.files ?? []) {
        const file = link.file;
        if (!file) {
          continue;
        }

        const buffer = await this.fileStorage.read(file.objectKey);
        const extracted = await extractDocumentContent({
          buffer,
          mimeType: file.mimeType,
        });

        extractedFileTexts.push({
          fileName: file.originalName,
          text: extracted.text,
        });

        if (extracted.pdfBuffer) {
          pdfParts.push({
            mimeType: PDF_MIME,
            data: extracted.pdfBuffer,
            fileName: file.originalName,
          });
        }
      }

      const providerResult = await this.getProvider().gradeSubmission({
        prompt: {
          assignmentName: fullEvaluation.submission.assignment.name,
          assignmentDescription: fullEvaluation.submission.assignment.description,
          evaluationInstructions:
            fullEvaluation.submission.assignment.evaluationInstructions,
          questionSelectionInstructions:
            fullEvaluation.submission.assignment.questionSelectionInstructions,
          maxScore: fullEvaluation.submission.assignment.maxScore,
          questions,
          answerText: fullEvaluation.submission.answerText,
          extractedFileTexts,
        },
        pdfParts,
        model: evaluation.model,
        promptVersion: evaluation.promptVersion,
      });

      const validated = validateGradingAgainstQuestions(
        providerResult.data,
        questions,
        fullEvaluation.submission.assignment.maxScore,
      );

      await this.evaluationRepository.persistCompleted({
        evaluationId: fullEvaluation.id,
        score: validated.score,
        maxScore: validated.maxScore,
        feedback: providerResult.data.overallFeedback,
        selectionSummary: providerResult.data.selectionSummary,
        confidence: validated.confidence,
        questionResults: validated.questionResults,
        audit: {
          requestPayload: providerResult.requestPayload,
          rawResponse: providerResult.rawResponse,
          providerRequestId: providerResult.providerRequestId,
          tokenUsage: providerResult.tokenUsage,
          latencyMs: providerResult.latencyMs,
          validationErrors: null,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown grading failure";
      const validationErrors =
        error instanceof DomainValidationError ? error.details : null;

      await this.evaluationRepository.markFailedOrRetry(
        {
          ...evaluation,
          attemptCount: evaluation.attemptCount,
          maxAttempts: evaluation.maxAttempts || config.workerMaxAttempts,
        },
        message,
        validationErrors,
      );
      throw error;
    }
  }

  async processQuestionImport(
    questionImport: AssignmentQuestionImport,
  ): Promise<void> {
    const config = getGradingConfig();
    try {
      const fullImport = await this.questionImportRepository.findById(
        questionImport.id,
      );

      if (!fullImport?.assignment || !fullImport.file) {
        throw new Error(`Question import ${questionImport.id} is incomplete`);
      }

      if (await this.questionImportRepository.isSuperseded(fullImport)) {
        await this.questionImportRepository.markSuperseded(fullImport.id);
        return;
      }

      const buffer = await this.fileStorage.read(fullImport.file.objectKey);
      const extracted = await extractDocumentContent({
        buffer,
        mimeType: fullImport.file.mimeType,
      });

      const pdfParts: ProviderBinaryPart[] = extracted.pdfBuffer
        ? [
            {
              mimeType: PDF_MIME,
              data: extracted.pdfBuffer,
              fileName: fullImport.file.originalName,
            },
          ]
        : [];

      const providerResult = await this.getProvider().extractQuestions({
        prompt: {
          assignmentName: fullImport.assignment.name,
          assignmentDescription: fullImport.assignment.description,
          evaluationInstructions: fullImport.assignment.evaluationInstructions,
          maxScore: fullImport.assignment.maxScore,
          extractedText: extracted.text || null,
        },
        pdfParts,
        model: questionImport.model,
        promptVersion: questionImport.promptVersion,
      });

      const validated = validateExtractedQuestions(
        providerResult.data,
        fullImport.assignment.maxScore,
      );

      if (await this.questionImportRepository.isSuperseded(fullImport)) {
        await this.questionImportRepository.markSuperseded(fullImport.id);
        return;
      }

      await AppDataSource.transaction(async (manager) => {
        const assignment = await manager.getRepository(Assignment).findOne({
          where: { id: fullImport.assignmentId },
          lock: { mode: "pessimistic_write" },
        });
        if (!assignment) {
          throw new Error(`Assignment not found: ${fullImport.assignmentId}`);
        }

        if (
          await this.questionImportRepository.isSuperseded(fullImport, manager)
        ) {
          await this.questionImportRepository.markSuperseded(
            fullImport.id,
            manager,
          );
          return;
        }

        assignment.questionSelectionInstructions =
          validated.selectionInstructions;
        await manager.getRepository(Assignment).save(assignment);

        await this.questionRepository.replaceQuestionsWithManager(
          manager,
          fullImport.assignmentId,
          fullImport.assignment.maxScore,
          validated.questions.map(
            (question: (typeof validated.questions)[number]) => ({
              questionKey: question.questionKey,
              orderIndex: question.orderIndex,
              prompt: question.prompt,
              rubric: question.rubric ?? null,
              maxScore: question.maxScore,
              source: QuestionSource.DOCUMENT_IMPORT,
              importId: fullImport.id,
            }),
          ),
        );

        await this.questionImportRepository.markCompleted(
          fullImport.id,
          providerResult.rawResponse,
          manager,
        );
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown question import failure";

      await this.questionImportRepository.markFailedOrRetry(
        {
          ...questionImport,
          attemptCount: questionImport.attemptCount,
          maxAttempts: questionImport.maxAttempts || config.workerMaxAttempts,
        },
        message,
      );
      throw error;
    }
  }
}
