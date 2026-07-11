import dotenv from "dotenv";
import Database from "ltijs-sequelize";
import { boostrapLti } from "./lti-boostrap.js";
import { boostrapExpress } from "./express-boostrap.js";

dotenv.config();

const db = new Database(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    logging: false,
  },
);

void boostrapLti(db);
