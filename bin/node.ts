#!/usr/bin/env node
import { parseArgs } from "node:util";
import * as path from "node:path";
import PgPool from "pg-pool";
import { promises as fsPromises } from "node:fs";
import {
  FileMigrationProvider,
  Kysely,
  Migrator,
  PostgresDialect,
} from "kysely";
import {
  createPgDatabase,
  createPgRole,
  SystemDatabase,
  UtilConfig,
} from "../src/index.ts";

const MODE_MIGRATE_INIT = "migrate-init";
const MODE = [MODE_MIGRATE_INIT] as const;

async function main() {
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
  const config = await (async () => {
    if (!args.config) {
      usage();
    }

    const configPath =
      args.config.startsWith("/") || args.config.match(/^[^:]:\/\//)
        ? args.config
        : `file://${process.cwd().replace(/\\/g, "/")}/${args.config}`;
    try {
      const { "default": content } = await import(configPath);
      if (typeof content != "object" || !content) {
        throw new Error("invalid config format");
      }
      if (typeof content.database != "string") {
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
      if (typeof content.owner.user != "string") {
        throw new Error("invalid config format: owner.user");
      }
      if (typeof content.owner.password != "string") {
        throw new Error("invalid config format: owner.password");
      }
      if (content.superUser) {
        if (typeof content.superUser != "object") {
          throw new Error("invalid config format: superUser");
        }
        if (typeof content.superUser.user != "string") {
          throw new Error("invalid config format: superUser.user");
        }
        if (typeof content.superUser.password != "string") {
          throw new Error("invalid config format: superUser.password");
        }
        if (typeof content.superUser.database != "string") {
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
  })();

  switch (args.mode) {
    case MODE_MIGRATE_INIT:
      await migrateInit(config);
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

main();

export default {};
