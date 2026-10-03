import { z } from "zod";

export const appealAiRecommendationSchema = z.object({
  decision: z.enum(["ACCEPTED", "REJECTED"]),
  recommendedScore: z.number().nonnegative(),
  resolution: z.string().min(20),
  rationale: z.string().min(20),
  confidence: z.number().min(0).max(1),
});

export type AppealAiRecommendation = z.infer<
  typeof appealAiRecommendationSchema
>;

export const appealAiRecommendationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "decision",
    "recommendedScore",
    "resolution",
    "rationale",
    "confidence",
  ],
  properties: {
    decision: { type: "string", enum: ["ACCEPTED", "REJECTED"] },
    recommendedScore: { type: "number", minimum: 0 },
    resolution: { type: "string" },
    rationale: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;
