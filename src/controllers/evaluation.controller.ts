import { Response } from "express";
import { EvaluationRepository } from "../repositories/evaluation.repository.js";
import type { AuthenticatedRequest } from "../middleware/lti-auth.js";
import { isUuid } from "./user-controller.utils.js";

const evaluationRepository = new EvaluationRepository();

export const getEvaluation = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const evaluationId =
    typeof req.params.evaluationId === "string"
      ? req.params.evaluationId
      : undefined;

  if (!evaluationId || !isUuid(evaluationId) || !req.auth) {
    res.status(400).json({ message: "A valid evaluation ID is required" });
    return;
  }

  try {
    const evaluation = await evaluationRepository.findById(evaluationId);
    if (
      !evaluation ||
      evaluation.submission.assignment.courseId !== req.auth.courseId
    ) {
      res.status(404).json({ message: "Evaluation not found" });
      return;
    }

    if (
      req.auth.role === "STUDENT" &&
      evaluation.submission.studentId !== req.auth.userId
    ) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    res.json({
      id: evaluation.id,
      submissionId: evaluation.submissionId,
      status: evaluation.status,
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      feedback: evaluation.feedback,
      selectionSummary: evaluation.selectionSummary,
      confidence: evaluation.confidence,
      model: evaluation.model,
      promptVersion: evaluation.promptVersion,
      isFinal: evaluation.isFinal,
      errorMessage:
        evaluation.status === "FAILED"
          ? "Evaluation failed after all retry attempts"
          : null,
      attemptCount: evaluation.attemptCount,
      maxAttempts: evaluation.maxAttempts,
      questionResults: (evaluation.questionResults ?? []).map((result) => ({
        id: result.id,
        questionId: result.questionId,
        questionKey: result.question?.questionKey ?? null,
        orderIndex: result.question?.orderIndex ?? null,
        prompt: result.question?.prompt ?? null,
        score: result.score,
        maxScore: result.maxScore,
        isAnswered: result.isAnswered,
        countsTowardTotal: result.countsTowardTotal,
        selectionReason: result.selectionReason,
        feedback: result.feedback,
        evidence: result.evidence,
        confidence: result.confidence,
      })),
      createdAt: evaluation.createdAt,
      updatedAt: evaluation.updatedAt,
      completedAt: evaluation.completedAt,
    });
  } catch (error) {
    console.error("Failed to fetch evaluation:", error);
    res.status(500).json({ message: "Failed to fetch evaluation" });
  }
};
