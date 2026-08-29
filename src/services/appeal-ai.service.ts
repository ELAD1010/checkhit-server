import { getGradingConfig } from "../config/grading.config.js";
import type { Appeal } from "../entities/appeal.js";
import type { ProviderBinaryPart } from "../grading/gemini-provider.js";
import {
  GeminiAppealProvider,
  type AppealAiProvider,
} from "../appeals/gemini-appeal-provider.js";
import { AppealRepository } from "../repositories/appeal.repository.js";
import { AssignmentQuestionRepository } from "../repositories/assignment-question.repository.js";
import { extractDocumentContent } from "../storage/document-content.js";
import {
  LocalFileStorage,
  type FileStorage,
} from "../storage/local-file-storage.js";

export interface ReviewAppealWithAiInput {
  appealId: string;
  lecturerId: string;
  autoResolve?: boolean;
}

export class AppealAiService {
  constructor(
    private readonly appealRepository = new AppealRepository(),
    private readonly questionRepository = new AssignmentQuestionRepository(),
    private readonly fileStorage: FileStorage = new LocalFileStorage(),
    private readonly provider: AppealAiProvider | null = null,
  ) {}

  async review(input: ReviewAppealWithAiInput): Promise<Appeal> {
    const appeal = await this.appealRepository.assertLecturerCanReview(
      input.appealId,
      input.lecturerId,
    );
    const assignment = appeal.submission.assignment;
    const questions = await this.questionRepository.listByAssignmentId(
      assignment.id,
    );
    const submissionDocuments = await this.extractFiles(
      (appeal.submission.files ?? []).map((link) => link.file),
    );
    const evidenceDocuments = await this.extractFiles(
      (appeal.files ?? []).map((link) => link.file),
    );
    const config = getGradingConfig();
    const provider = this.provider ?? new GeminiAppealProvider();
    const result = await provider.review({
      model: config.geminiModel,
      promptVersion: "appeal-v1",
      pdfParts: [
        ...submissionDocuments.pdfParts,
        ...evidenceDocuments.pdfParts,
      ],
      prompt: {
        assignmentName: assignment.name,
        assignmentDescription: assignment.description,
        evaluationInstructions: assignment.evaluationInstructions,
        maxScore: assignment.maxScore,
        questions: questions.map((question) => ({
          questionKey: question.questionKey,
          prompt: question.prompt,
          rubric: question.rubric,
          maxScore: question.maxScore,
        })),
        answerText: appeal.submission.answerText,
        extractedFiles: submissionDocuments.texts,
        originalScore: appeal.evaluation.score ?? 0,
        originalFeedback: appeal.evaluation.feedback,
        appealReason: appeal.reason,
        appealCategory: appeal.category,
        evidenceFiles: evidenceDocuments.texts,
      },
    });

    return input.autoResolve
      ? this.appealRepository.resolveAppealByAi(
          appeal.id,
          result.data,
          config.geminiModel,
        )
      : this.appealRepository.saveAiRecommendation(
          appeal.id,
          result.data,
          config.geminiModel,
        );
  }

  private async extractFiles(
    files: Array<{
      objectKey: string;
      originalName: string;
      mimeType: string;
    }>,
  ): Promise<{
    texts: Array<{ fileName: string; text: string }>;
    pdfParts: ProviderBinaryPart[];
  }> {
    const texts: Array<{ fileName: string; text: string }> = [];
    const pdfParts: ProviderBinaryPart[] = [];
    for (const file of files) {
      const buffer = await this.fileStorage.read(file.objectKey);
      const extracted = await extractDocumentContent({
        buffer,
        mimeType: file.mimeType,
      });
      texts.push({ fileName: file.originalName, text: extracted.text });
      if (extracted.pdfBuffer) {
        pdfParts.push({
          mimeType: file.mimeType,
          data: extracted.pdfBuffer,
          fileName: file.originalName,
        });
      }
    }
    return { texts, pdfParts };
  }
}
