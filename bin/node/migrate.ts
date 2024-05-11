import { promises as fsPromises } from "node:fs";
import * as path from "node:path";
import process from "node:process";
import {
  FileMigrationProvider,
  Kysely,
  LogConfig,
  Migrator,
  PostgresDialect,
} from "kysely";
import PgPool from "pg-pool";
import {
  createPgDatabase,
  createPgRole,
  DryMigrationPgPool,
  DryMigrationQueries,
  SystemDatabase,
  UtilConfig,
} from "../../src/index.ts";
import { getPath } from "./utils.ts";

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
    await createPgDatabase(db, config.database, {
      owner: config.owner.user,
      ...config.createDbOptions,
    });
  } catch (err) {
    console.warn(err);
  }
  await db.destroy();
}

export async function migrate(
  config: UtilConfig,
  mode: "latest" | "down",
  dry?: boolean,
) {
  const poolConfig = {
    host: config.host ?? "localhost",
    port: config.port ?? 5432,
    database: config.database,
    user: config.owner.user,
    password: config.owner.password,
  };
  const dryRunQueries: DryMigrationQueries = [];
  // deno-lint-ignore no-explicit-any
  const db = new Kysely<any>({
    dialect: new PostgresDialect({
      pool: dry
        ? new DryMigrationPgPool(poolConfig, { queries: dryRunQueries })
        : new PgPool(poolConfig),
    }),
    log: !config.verbose || (dry && !config.dryMigrateOutput)
      ? undefined
      : outputLog,
  });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs: fsPromises,
      path,
      migrationFolder: getPath(config.migrate),
    }),
  });

  const { error, results } = mode == "latest"
    ? await migrator.migrateToLatest()
    : await migrator.migrateDown();

  console.log("");
  if (!dry) {
    results?.forEach((it) => {
      if (it.status === "Success") {
        console.log(
          `\u001b[36mmigration "${it.migrationName}" was executed successfully\u001b[0m`,
        );
      } else if (it.status === "Error") {
        console.error(
          `\u001b[35mfailed to execute migration "${it.migrationName}"\u001b[0m`,
        );
      }
    });
  } else {
    const dryResults = dryRunQueries.map((query) => query.sql).join("\n");
    if (config.dryMigrateOutput) {
      await fsPromises.writeFile(config.dryMigrateOutput, dryResults + "\n", {
        encoding: "utf8",
      });
    } else {
      console.log(dryResults);
    }
  }
  if (results?.length == 0) {
    console.log("\u001b[36malready latest\u001b[0m");
  }

  if (error) {
    console.error("\u001b[35mfailed to migrate\u001b[0m");
    console.error(error);
    process.exit(1);
  }

  await db.destroy();
  process.exit(0); // for dry run
}
