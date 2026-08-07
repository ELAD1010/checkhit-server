declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production" | "test";
      PORT: number;
      FRONTEND_URL: string;
      DB_USER: string;
      DB_PASSWORD: string;
      DB_HOST: string;
      DB_PORT: number;
      DB_NAME: string;
      LTI_DB_NAME: string;
      LTI_ENCRYPTION_KEY: string;
      MOODLE_URL: string;
      MOODLE_CLIENT_ID: string;
      MOODLE_WS_TOKEN: string;
      GEMINI_API_KEY?: string;
      GEMINI_MODEL?: string;
      GRADING_PROMPT_VERSION?: string;
      QUESTION_IMPORT_PROMPT_VERSION?: string;
      FILE_STORAGE_ROOT?: string;
      MAX_UPLOAD_BYTES?: string;
      GRADING_WORKER_POLL_INTERVAL_MS?: string;
      GRADING_WORKER_MAX_ATTEMPTS?: string;
      GRADING_WORKER_ENABLED?: string;
    }
  }
}

export {};
