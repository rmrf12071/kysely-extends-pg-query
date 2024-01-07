#!/usr/bin/env node
import { parseArgs } from "node:util";
import * as path from "node:path";
import { promises as fsPromises } from "node:fs";
import { register } from "esbuild-register/dist/node";
import {
  FileMigrationProvider,
  Kysely,
  Migrator,
  PostgresDialect,
} from "kysely";
import PgPool from "pg-pool";
import {
  createPgDatabase,
  createPgRole,
  SystemDatabase,
  UtilConfig,
} from "../src/index.ts";

const MODE_MIGRATE_INIT = "migrate-init";
const MODE_MIGRATE_LATEST = "migrate-latest";
const MODE_MIGRATE_DOWN = "migrate-down";
const MODE = [
  MODE_MIGRATE_INIT,
  MODE_MIGRATE_LATEST,
  MODE_MIGRATE_DOWN,
] as const;

async function main() {
  // parse command arguments
  const { values: args } = parseArgs({
    options: {
      mode: {
        type: "string",
      },
      config: {
        type: "string",
      },
    },
  });

  // check mode
  if (!(MODE as ReadonlyArray<string>).includes(args.mode ?? "")) {
    usage();
  }

  // check and parse config file
  const config = parseConfig(args);

  // execute command
  switch (args.mode) {
    case MODE_MIGRATE_INIT:
      await migrateInit(config);
      break;
    case MODE_MIGRATE_LATEST:
      await migrate(config, "latest");
      break;
    case MODE_MIGRATE_DOWN:
      await migrate(config, "down");
      break;
    default:
      usage();
  }
}

function usage(): never {
  console.log(
    `usage: ${process.argv[0]} ${process.argv[1]} --mode [${
      MODE.join("/")
    }] --config config.js`,
  );
  process.exit(1);
  throw new Error(); // for deno language server
}

function getPath(parts: string) {
  return parts.startsWith("/") || parts.match(/^[^:]:\/\//)
    ? parts
    : `${process.cwd().replace(/\\/g, "/")}/${parts}`;
}

function parseConfig(
  args: { config?: string; mode?: string },
) {
  if (!args.config) {
    usage();
  }

  const configPath = getPath(args.config);
  register({ sourcefile: configPath });
  try {
    const { default: content } = require(configPath);
    if (typeof content != "object" || !content) {
      throw new Error("invalid config format");
    }
    if (!content.database || typeof content.database != "string") {
      throw new Error("invalid config format: database");
    }
    if (content.host && typeof content.host != "string") {
      throw new Error("invalid config format: host");
    }
    if (content.port && typeof content.port != "number") {
      throw new Error("invalid config format: host");
    }
    if (typeof content.owner != "object") {
      throw new Error("invalid config format: owner");
    }
    if (!content.owner.user || typeof content.owner.user != "string") {
      throw new Error("invalid config format: owner.user");
    }
    if (
      !content.owner.password || typeof content.owner.password != "string"
    ) {
      throw new Error("invalid config format: owner.password");
    }
    if (!content.migrate || typeof content.migrate !== "string") {
      throw new Error("invalid config format: migrate");
    }
    if (content.superUser) {
      if (typeof content.superUser != "object") {
        throw new Error("invalid config format: superUser");
      }
      if (
        !content.superUser.user || typeof content.superUser.user != "string"
      ) {
        throw new Error("invalid config format: superUser.user");
      }
      if (
        !content.superUser.password ||
        typeof content.superUser.password != "string"
      ) {
        throw new Error("invalid config format: superUser.password");
      }
      if (
        !content.superUser.database ||
        typeof content.superUser.database != "string"
      ) {
        throw new Error("invalid config format: superUser.database");
      }
    } else if (args.mode == MODE_MIGRATE_INIT) {
      throw new Error("invalid config format: superUser(required)");
    }
    return content as UtilConfig;
  } catch (err) {
    console.error(err);
    process.exit(1);
    throw new Error(); // for deno language server
  }
}

async function migrateInit(config: UtilConfig) {
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
  });
  await createPgRole(db, config.owner.user, config.owner.password);
  await createPgDatabase(db, config.database, config.owner.user);
  await db.destroy();
}

async function migrate(config: UtilConfig, mode: "latest" | "down") {
  // deno-lint-ignore no-explicit-any
  const db = new Kysely<any>({
    dialect: new PostgresDialect({
      pool: new PgPool({
        host: config.host ?? "localhost",
        port: config.port ?? 5432,
        database: config.database,
        user: config.owner.user,
        password: config.owner.password,
      }),
    }),
  });

  const migrationFolder = getPath(config.migrate);

  // prepare to read migration files written by typescript
  const dirFiles = await fsPromises.readdir(migrationFolder);
  for (const file of dirFiles) {
    register({ sourcefile: path.join(migrationFolder, file) });
  }

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs: fsPromises,
      path,
      migrationFolder,
    }),
  });

  const { error, results } = mode == "latest"
    ? await migrator.migrateToLatest()
    : await migrator.migrateDown();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === "Error") {
      console.error(`failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("failed to migrate");
    console.error(error);
    process.exit(1);
  }

  await db.destroy();
}

main();

export default {};
