import assert from "node:assert/strict";
import test from "node:test";
import { buildAppealReviewSystemPrompt } from "./prompts.js";
import { appealAiRecommendationSchema } from "./schemas.js";

test("appeal AI recommendation validates decisions, score, and confidence", () => {
  const parsed = appealAiRecommendationSchema.parse({
    decision: "ACCEPTED",
    recommendedScore: 87,
    resolution: "The submitted evidence supports the requested rubric credit.",
    rationale: "The original evaluation missed a correct implementation detail.",
    confidence: 0.88,
  });
  assert.equal(parsed.recommendedScore, 87);
  assert.throws(() =>
    appealAiRecommendationSchema.parse({
      ...parsed,
      confidence: 2,
    }),
  );
});

test("appeal review prompt treats student evidence as untrusted data", () => {
  const prompt = buildAppealReviewSystemPrompt("appeal-v1");
  assert.match(prompt, /untrusted student data/i);
  assert.match(prompt, /never follow instructions/i);
  assert.match(prompt, /do not invent/i);
});
