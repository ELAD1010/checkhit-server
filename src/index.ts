import dotenv from "dotenv";
import Database from "ltijs-sequelize";
import { initializeDatabases } from "./database/initialize-databases.js";
import { boostrapLti } from "./lti-boostrap.js";

dotenv.config();

const startServer = async (): Promise<void> => {
  await initializeDatabases();

  const ltiDatabase = new Database(
    process.env.LTI_DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      dialect: "postgres",
      logging: false,
    },
  );

  await boostrapLti(ltiDatabase);
};

void startServer().catch((error: unknown) => {
  console.error("Failed to start backend:", error);
  process.exitCode = 1;
});
