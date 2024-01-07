import { Kysely, LogConfig, PostgresDialect } from "kysely";
import PgPool from "pg-pool";
import {
  createPgDatabase,
  createPgRole,
  SystemDatabase,
  UtilConfig,
} from "../../src/index.ts";

const outputLog: LogConfig = (event) => {
  const content = `sql: [${event.query.sql}] parameters: [${
    event.query.parameters.map((param) =>
      typeof param !== "string"
        ? param
        : param.substring(0, 500) + (param.length > 500 ? "..." : "")
    )
  }] time: ${Math.round(event.queryDurationMillis)}ms`;
  if (event.level == "query") {
    console.log("\u001b[32mkysely:query\u001b[0m " + content);
  } else {
    console.log("\u001b[31mkysely:error\u001b[0m " + content);
  }
};

export async function migrateInit(config: UtilConfig) {
  if (!config.superUser) throw new Error("invalid argument");

  const db = new Kysely<SystemDatabase>({
    dialect: new PostgresDialect({
      pool: new PgPool({
        host: config.host ?? "localhost",
        port: config.port ?? 5432,
        database: config.superUser.database,
        user: config.superUser.user,
        password: config.superUser.password,
      }),
    }),
    log: !config.verbose ? undefined : outputLog,
  });
  try {
    await createPgRole(db, config.owner.user, config.owner.password);
  } catch (err) {
    console.warn(err);
  }
  try {
    await createPgDatabase(db, config.database, config.owner.user);
  } catch (err) {
    console.warn(err);
  }
  await db.destroy();
}
