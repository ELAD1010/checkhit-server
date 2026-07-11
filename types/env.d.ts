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
      LTI_ENCRYPTION_KEY: string;
      MOODLE_URL: string;
      MOODLE_CLIENT_ID: string;
      MOODLE_WS_TOKEN: string;
    }
  }
}

export {};
