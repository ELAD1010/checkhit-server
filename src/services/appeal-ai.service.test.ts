import assert from "node:assert/strict";
import test from "node:test";
import type { AppealAiProvider } from "../appeals/gemini-appeal-provider.js";
import { AppealStatus, EvaluationStatus, SubmissionStatus } from "../entities/enums.js";
import { AppealAiService } from "./appeal-ai.service.js";

test("AI appeal review builds full context and stores a recommendation", async () => {
  let receivedPrompt: Record<string, unknown> = {};
  let saved = false;
  const appeal = {
    id: "appeal-1",
    reason: "The rubric awarded no credit for a correct edge-case implementation.",
    category: "grading_error",
    status: AppealStatus.SUBMITTED,
    evaluation: {
      score: 70,
      maxScore: 100,
      feedback: "Edge cases were not handled.",
      status: EvaluationStatus.COMPLETED,
    },
    submission: {
      answerText: "The implementation handles an empty input.",
      status: SubmissionStatus.SUBMITTED,
      files: [],
      assignment: {
        id: "assignment-1",
        name: "Sorting",
        description: "Implement a sorting algorithm.",
        evaluationInstructions: "Follow the rubric.",
        maxScore: 100,
      },
    },
    files: [],
  };
  const repository = {
    async assertLecturerCanReview() { return appeal; },
    async saveAiRecommendation(_id: string, recommendation: unknown) {
      saved = true;
      return { ...appeal, aiRecommendation: recommendation };
    },
    async resolveAppealByAi() { throw new Error("should not auto-resolve"); },
  };
  const provider: AppealAiProvider = {
    async review(input) {
      receivedPrompt = input.prompt as unknown as Record<string, unknown>;
      return {
        data: {
          decision: "ACCEPTED",
          recommendedScore: 80,
          resolution: "The appeal is accepted because the edge case is implemented.",
          rationale: "The submitted code contradicts the original feedback.",
          confidence: 0.9,
        },
        rawText: "{}",
        rawResponse: {},
        providerRequestId: null,
        tokenUsage: null,
        latencyMs: 1,
        requestPayload: {},
      };
    },
  };
  const service = new AppealAiService(
    repository as never,
    { async listByAssignmentId() { return [{
      questionKey: "Q1",
      prompt: "Handle edge cases",
      rubric: "20 points",
      maxScore: 20,
    }]; } } as never,
    { async read() { return Buffer.from(""); } } as never,
    provider,
  );

  const result = await service.review({
    appealId: "appeal-1",
    lecturerId: "lecturer-1",
  });

  assert.equal(saved, true);
  assert.equal(receivedPrompt.originalScore, 70);
  assert.equal((receivedPrompt.questions as unknown[]).length, 1);
  assert.deepEqual(result.aiRecommendation, {
    decision: "ACCEPTED",
    recommendedScore: 80,
    resolution: "The appeal is accepted because the edge case is implemented.",
    rationale: "The submitted code contradicts the original feedback.",
    confidence: 0.9,
  });
});

test("AI appeal review can apply its decision when autoResolve is enabled", async () => {
  let resolved = false;
  const appeal = {
    id: "appeal-2",
    reason: "The final answer matches the supplied rubric and should receive credit.",
    category: "grading_error",
    status: AppealStatus.SUBMITTED,
    evaluation: { score: 60, maxScore: 100, feedback: null },
    submission: {
      answerText: "A complete answer",
      files: [],
      assignment: {
        id: "assignment-2",
        name: "Algorithms",
        description: "Answer the questions.",
        evaluationInstructions: "Use the rubric.",
        maxScore: 100,
      },
    },
    files: [],
  };
  const recommendation = {
    decision: "REJECTED" as const,
    recommendedScore: 60,
    resolution: "The original evaluation correctly applied the published rubric.",
    rationale: "The appeal supplies no evidence that changes the rubric outcome.",
    confidence: 0.82,
  };
  const service = new AppealAiService(
    {
      async assertLecturerCanReview() { return appeal; },
      async saveAiRecommendation() { throw new Error("should auto-resolve"); },
      async resolveAppealByAi(_id: string, value: unknown) {
        resolved = value === recommendation;
        return { ...appeal, status: AppealStatus.REJECTED };
      },
    } as never,
    { async listByAssignmentId() { return []; } } as never,
    { async read() { return Buffer.from(""); } } as never,
    {
      async review() {
        return {
          data: recommendation,
          rawText: "{}",
          rawResponse: {},
          providerRequestId: null,
          tokenUsage: null,
          latencyMs: 1,
          requestPayload: {},
        };
      },
    },
  );

  const result = await service.review({
    appealId: "appeal-2",
    lecturerId: "lecturer-1",
    autoResolve: true,
  });

  assert.equal(resolved, true);
  assert.equal(result.status, AppealStatus.REJECTED);
});
