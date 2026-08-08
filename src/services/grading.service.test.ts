import assert from "node:assert/strict";
import test from "node:test";
import { GradingService } from "./grading.service.js";
import type { GradingAiProvider } from "../grading/gemini-provider.js";
import { EvaluationStatus, QuestionSource } from "../entities/enums.js";

test("GradingService grades with fake provider and persists aggregated score", async () => {
  const questionId = "11111111-1111-4111-8111-111111111111";
  let persisted: unknown = null;

  const fakeProvider: GradingAiProvider = {
    async gradeSubmission() {
      return {
        data: {
          overallFeedback: "Nice work",
          selectionSummary: "All questions are mandatory.",
          overallConfidence: 0.85,
          questions: [
            {
              questionId,
              score: 9,
              isAnswered: true,
              countsTowardTotal: true,
              selectionReason: "Mandatory question",
              feedback: "Strong answer",
              evidence: "polymorphism means...",
              confidence: 0.9,
            },
          ],
        },
        rawText: "{}",
        rawResponse: { ok: true },
        providerRequestId: "req-1",
        tokenUsage: { promptTokenCount: 10 },
        latencyMs: 12,
        requestPayload: { kind: "grading" },
      };
    },
    async extractQuestions() {
      throw new Error("not used");
    },
  };

  const evaluationRepository = {
    async findById() {
      return {
        id: "eval-1",
        questionSetId: "33333333-3333-4333-8333-333333333333",
        attemptCount: 1,
        maxAttempts: 3,
        submission: {
          assignmentId: "assignment-1",
          answerText: "Polymorphism is many forms",
          files: [],
          assignment: {
            name: "Midterm",
            description: "OOP",
            evaluationInstructions: "Be fair",
            questionSelectionInstructions: null,
            maxScore: 10,
          },
        },
      };
    },
    async persistCompleted(input: unknown) {
      persisted = input;
      return input;
    },
    async markFailedOrRetry() {
      throw new Error("should not fail");
    },
  };

  const questionRepository = {
    async listByQuestionSetId() {
      return [
        {
          id: questionId,
          questionKey: "Q1",
          orderIndex: 0,
          prompt: "Explain polymorphism",
          rubric: "Definition + example",
          maxScore: 10,
          source: QuestionSource.MANUAL,
        },
      ];
    },
  };

  const service = new GradingService(
    evaluationRepository as never,
    questionRepository as never,
    {} as never,
    {
      async read() {
        return Buffer.from("");
      },
    } as never,
    fakeProvider,
  );

  await service.processEvaluation({
    id: "eval-1",
    attemptCount: 1,
    maxAttempts: 3,
    model: "fake-model",
    promptVersion: "test-v1",
    status: EvaluationStatus.PROCESSING,
  } as never);

  assert.deepEqual(
    (persisted as { score: number; questionResults: unknown[] }).score,
    9,
  );
  assert.equal(
    (persisted as { questionResults: unknown[] }).questionResults.length,
    1,
  );
});
