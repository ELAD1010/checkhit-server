import { GoogleGenAI } from "@google/genai";
import { requireGeminiApiKey } from "../config/grading.config.js";
import {
  buildGradingSystemPrompt,
  buildGradingUserPrompt,
  buildQuestionImportSystemPrompt,
  buildQuestionImportUserPrompt,
  type GradingPromptInput,
  type QuestionImportPromptInput,
} from "./prompts.js";
import {
  gradingResponseJsonSchema,
  gradingResponseSchema,
  questionExtractionResponseJsonSchema,
  questionExtractionResponseSchema,
  type GradingResponse,
  type QuestionExtractionResponse,
} from "./schemas.js";

export type ProviderBinaryPart = {
  mimeType: string;
  data: Buffer;
  fileName?: string;
};

export type AiProviderResult<T> = {
  data: T;
  rawText: string;
  rawResponse: Record<string, unknown>;
  providerRequestId: string | null;
  tokenUsage: Record<string, unknown> | null;
  latencyMs: number;
  requestPayload: Record<string, unknown>;
};

export interface GradingAiProvider {
  gradeSubmission(input: {
    prompt: GradingPromptInput;
    pdfParts?: ProviderBinaryPart[];
    model: string;
    promptVersion: string;
  }): Promise<AiProviderResult<GradingResponse>>;
  extractQuestions(input: {
    prompt: QuestionImportPromptInput;
    pdfParts?: ProviderBinaryPart[];
    model: string;
    promptVersion: string;
  }): Promise<AiProviderResult<QuestionExtractionResponse>>;
}

const toInlineDataPart = (part: ProviderBinaryPart) => ({
  inlineData: {
    mimeType: part.mimeType,
    data: part.data.toString("base64"),
  },
});

export class GeminiGradingProvider implements GradingAiProvider {
  private readonly client: GoogleGenAI;

  constructor(apiKey = requireGeminiApiKey()) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async gradeSubmission(input: {
    prompt: GradingPromptInput;
    pdfParts?: ProviderBinaryPart[];
    model: string;
    promptVersion: string;
  }): Promise<AiProviderResult<GradingResponse>> {
    const systemInstruction = buildGradingSystemPrompt(input.promptVersion);
    const userText = buildGradingUserPrompt(input.prompt);
    const parts = [
      { text: userText },
      ...(input.pdfParts ?? []).map(toInlineDataPart),
    ];

    return this.generateStructured({
      systemInstruction,
      parts,
      responseJsonSchema: gradingResponseJsonSchema,
      model: input.model,
      parse: (value) => gradingResponseSchema.parse(value),
      requestPayload: {
        kind: "grading",
        model: input.model,
        promptVersion: input.promptVersion,
        prompt: input.prompt,
        pdfFileNames: (input.pdfParts ?? []).map(
          (part) => part.fileName ?? "document.pdf",
        ),
      },
    });
  }

  async extractQuestions(input: {
    prompt: QuestionImportPromptInput;
    pdfParts?: ProviderBinaryPart[];
    model: string;
    promptVersion: string;
  }): Promise<AiProviderResult<QuestionExtractionResponse>> {
    const systemInstruction = buildQuestionImportSystemPrompt(
      input.promptVersion,
    );
    const userText = buildQuestionImportUserPrompt(input.prompt);
    const parts = [
      { text: userText },
      ...(input.pdfParts ?? []).map(toInlineDataPart),
    ];

    return this.generateStructured({
      systemInstruction,
      parts,
      responseJsonSchema: questionExtractionResponseJsonSchema,
      model: input.model,
      parse: (value) => questionExtractionResponseSchema.parse(value),
      requestPayload: {
        kind: "question_import",
        model: input.model,
        promptVersion: input.promptVersion,
        prompt: input.prompt,
        pdfFileNames: (input.pdfParts ?? []).map(
          (part) => part.fileName ?? "document.pdf",
        ),
      },
    });
  }

  private async generateStructured<T>(input: {
    systemInstruction: string;
    parts: Array<Record<string, unknown>>;
    responseJsonSchema: unknown;
    model: string;
    parse: (value: unknown) => T;
    requestPayload: Record<string, unknown>;
  }): Promise<AiProviderResult<T>> {
    const startedAt = Date.now();
    const response = await this.client.models.generateContent({
      model: input.model,
      contents: [
        {
          role: "user",
          parts: input.parts,
        },
      ],
      config: {
        systemInstruction: input.systemInstruction,
        responseMimeType: "application/json",
        responseJsonSchema: input.responseJsonSchema,
        temperature: 0.2,
      },
    });

    const rawText = response.text?.trim() ?? "";
    if (!rawText) {
      throw new Error("Gemini returned an empty response");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch (error) {
      throw new Error(
        `Gemini returned invalid JSON: ${
          error instanceof Error ? error.message : "parse error"
        }`,
      );
    }

    const data = input.parse(parsedJson);
    const usage = response.usageMetadata
      ? (response.usageMetadata as unknown as Record<string, unknown>)
      : null;

    return {
      data,
      rawText,
      rawResponse: {
        text: rawText,
        usageMetadata: usage,
        modelVersion:
          "modelVersion" in response
            ? (response as { modelVersion?: string }).modelVersion
            : undefined,
      },
      providerRequestId:
        "responseId" in response &&
        typeof (response as { responseId?: unknown }).responseId === "string"
          ? (response as { responseId: string }).responseId
          : null,
      tokenUsage: usage,
      latencyMs: Date.now() - startedAt,
      requestPayload: input.requestPayload,
    };
  }
}
