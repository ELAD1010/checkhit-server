import { DataSource } from "typeorm";
import { AppDataSource } from "./data-source.js";

const requireEnvironmentVariable = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const quotePostgresIdentifier = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`;

const isDuplicateDatabaseError = (
  error: unknown,
): error is { code: "42P04" } =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "42P04";

const ensureDatabasesExist = async (databaseNames: string[]): Promise<void> => {
  const maintenanceDataSource = new DataSource({
    type: "postgres",
    host: requireEnvironmentVariable("DB_HOST"),
    port: Number(requireEnvironmentVariable("DB_PORT")),
    username: requireEnvironmentVariable("DB_USER"),
    password: requireEnvironmentVariable("DB_PASSWORD"),
    database: "postgres",
    synchronize: false,
    logging: false,
  });

  await maintenanceDataSource.initialize();

  try {
    for (const databaseName of new Set(databaseNames)) {
      const existingDatabases = (await maintenanceDataSource.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [databaseName],
      )) as unknown[];

      if (existingDatabases.length > 0) {
        continue;
      }

      try {
        await maintenanceDataSource.query(
          `CREATE DATABASE ${quotePostgresIdentifier(databaseName)}`,
        );
        console.log(`Created PostgreSQL database: ${databaseName}`);
      } catch (error) {
        // Another backend instance may have created it after our existence check.
        if (!isDuplicateDatabaseError(error)) {
          throw error;
        }
      }
    }
  } finally {
    await maintenanceDataSource.destroy();
  }
};

export const initializeDatabases = async (): Promise<void> => {
  const applicationDatabase = requireEnvironmentVariable("DB_NAME");
  const ltiDatabase = requireEnvironmentVariable("LTI_DB_NAME");

  await ensureDatabasesExist([applicationDatabase, ltiDatabase]);
  await AppDataSource.initialize();
};
