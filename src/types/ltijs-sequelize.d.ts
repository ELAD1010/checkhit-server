declare module "ltijs-sequelize" {
  import type { Database as LtiDatabase } from "ltijs";

  type SequelizeOptions = {
    host?: string;
    port?: number | string;
    dialect: "postgres";
    logging?: boolean;
  };

  const SequelizeDatabase: new (
    databaseName: string,
    username: string,
    password: string,
    options: SequelizeOptions,
  ) => LtiDatabase;

  export default SequelizeDatabase;
}
