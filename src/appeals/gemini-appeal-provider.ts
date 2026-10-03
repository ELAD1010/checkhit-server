import { GoogleGenAI } from "@google/genai";
import { requireGeminiApiKey } from "../config/grading.config.js";
import type { AiProviderResult, ProviderBinaryPart } from "../grading/gemini-provider.js";
import {
  appealAiRecommendationJsonSchema,
  appealAiRecommendationSchema,
  type AppealAiRecommendation,
} from "./schemas.js";
import {
  buildAppealReviewSystemPrompt,
  buildAppealReviewUserPrompt,
  type AppealReviewPromptInput,
} from "./prompts.js";

export interface AppealAiProvider {
  review(input: {
    prompt: AppealReviewPromptInput;
    pdfParts?: ProviderBinaryPart[];
    model: string;
    promptVersion: string;
  }): Promise<AiProviderResult<AppealAiRecommendation>>;
}

export class GeminiAppealProvider implements AppealAiProvider {
  private readonly client: GoogleGenAI;

  constructor(apiKey = requireGeminiApiKey()) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async review(input: {
    prompt: AppealReviewPromptInput;
    pdfParts?: ProviderBinaryPart[];
    model: string;
    promptVersion: string;
  }): Promise<AiProviderResult<AppealAiRecommendation>> {
    const startedAt = Date.now();
    const requestPayload = {
      kind: "appeal_review",
      model: input.model,
      promptVersion: input.promptVersion,
      prompt: input.prompt,
      pdfFileNames: (input.pdfParts ?? []).map((part) => part.fileName),
    };
    const response = await this.client.models.generateContent({
      model: input.model,
      contents: [{
        role: "user",
        parts: [
          { text: buildAppealReviewUserPrompt(input.prompt) },
          ...(input.pdfParts ?? []).map((part) => ({
            inlineData: {
              mimeType: part.mimeType,
              data: part.data.toString("base64"),
            },
          })),
        ],
      }],
      config: {
        systemInstruction: buildAppealReviewSystemPrompt(input.promptVersion),
        responseMimeType: "application/json",
        responseJsonSchema: appealAiRecommendationJsonSchema,
        temperature: 0.1,
      },
    });
    const rawText = response.text?.trim() ?? "";
    if (!rawText) throw new Error("Gemini returned an empty appeal review");
    const data = appealAiRecommendationSchema.parse(JSON.parse(rawText));
    const usage = response.usageMetadata
      ? (response.usageMetadata as unknown as Record<string, unknown>)
      : null;
    return {
      data,
      rawText,
      rawResponse: { text: rawText, usageMetadata: usage },
      providerRequestId:
        "responseId" in response &&
        typeof (response as { responseId?: unknown }).responseId === "string"
          ? (response as { responseId: string }).responseId
          : null,
      tokenUsage: usage,
      latencyMs: Date.now() - startedAt,
      requestPayload,
    };
  }
}
