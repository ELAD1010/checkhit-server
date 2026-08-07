import path from "node:path";

const parsePositiveInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

export const GRADING_PROMPT_VERSION = "grading-v2";
export const QUESTION_IMPORT_PROMPT_VERSION = "question-import-v2";

export const getGradingConfig = () => {
  const storageRoot =
    process.env.FILE_STORAGE_ROOT?.trim() ||
    path.resolve(process.cwd(), "storage");

  return {
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || "",
    geminiModel:
      process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    promptVersion:
      process.env.GRADING_PROMPT_VERSION?.trim() || GRADING_PROMPT_VERSION,
    questionImportPromptVersion:
      process.env.QUESTION_IMPORT_PROMPT_VERSION?.trim() ||
      QUESTION_IMPORT_PROMPT_VERSION,
    storageRoot,
    maxUploadBytes: parsePositiveInteger(
      process.env.MAX_UPLOAD_BYTES,
      20 * 1024 * 1024,
    ),
    workerPollIntervalMs: parsePositiveInteger(
      process.env.GRADING_WORKER_POLL_INTERVAL_MS,
      2000,
    ),
    workerMaxAttempts: parsePositiveInteger(
      process.env.GRADING_WORKER_MAX_ATTEMPTS,
      3,
    ),
    workerEnabled: process.env.GRADING_WORKER_ENABLED === "true",
  };
};

export type GradingConfig = ReturnType<typeof getGradingConfig>;

export const requireGeminiApiKey = (config = getGradingConfig()): string => {
  if (!config.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is required for AI grading");
  }

  return config.geminiApiKey;
};

export const validateGradingConfig = (): void => {
  const config = getGradingConfig();
  if (config.workerEnabled) {
    requireGeminiApiKey(config);
  }
};
