import { Kysely, PostgresDialect, PostgresDialectConfig, sql } from "kysely";

export interface SystemDatabase {
  // define only some columns
  pg_database: {
    datname: string;
  };
  // define only some columns
  pg_class: {
    oid: number;
    relname: string;
    // r=normal table, i=index, s=sequence, v=view, c=union, s=special, t=toast table
    relkind: "r" | "i" | "S" | "v" | "c" | "s" | "t";
  };
  pg_description: {
    objoid: number;
    classoid: number;
    objsubid: number;
    description: string;
  };
}

/**
 * make kysely instance for system dataase
 * @param config config of PostgresDiarect
 * @returns instance of kysely
 */
export function makePgSystemKysely(config: PostgresDialectConfig) {
  return new Kysely<SystemDatabase>({
    dialect: new PostgresDialect(config),
    log: ["query", "error"],
  });
}

/**
 * create role of PostgreSQL server
 * @param db instance of kysely
 * @param role database role
 * @param password password of role
 * @returns result
 */
export function createPgRole(
  // deno-lint-ignore no-explicit-any
  db: Kysely<any>,
  role: string,
  password?: string,
) {
  return sql.raw(
    `create role ${role} with login${
      password ? ` password '${password}'` : ""
    }`,
  ).execute(db);
}

/**
 * create database of PostgreSQL
 * @param db instance of kysely
 * @param database database name
 * @param options options
 * @returns result
 */
export function createPgDatabase(
  // deno-lint-ignore no-explicit-any
  db: Kysely<any>,
  database: string,
  options?: {
    owner?: string;
    template?: string;
    encoding?: string;
    locale?: string;
    lc_collate?: string;
    lc_ctype?: string;
    tablespace?: string;
    allow_connections?: boolean;
    connection_limit?: number;
    is_template?: boolean;
  },
) {
  const opts: string[] = [];
  for (const key of Object.keys(options ?? {})) {
    opts.push(`${key} ${options?.[key as keyof typeof options]?.toString()}`);
  }
  return sql.raw(
    `create database ${database}${opts.length > 0 ? ` ${opts.join(" ")}` : ""}`,
  )
    .execute(db);
}
