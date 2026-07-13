import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { DOMAIN_ENTITIES } from "../entities/index.js";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [...DOMAIN_ENTITIES],
  migrations: ["dist/database/migrations/*.js"],
  synchronize: true,
  logging: process.env.NODE_ENV === "development",
});
