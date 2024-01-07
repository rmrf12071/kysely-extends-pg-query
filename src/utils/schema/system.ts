import { Kysely, PostgresDialect, PostgresDialectConfig, sql } from "kysely";

export interface SystemDatabase {
  pg_database: {
    datname: string;
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

export function createPgDatabase(
  // deno-lint-ignore no-explicit-any
  db: Kysely<any>,
  database: string,
  role?: string,
) {
  return sql.raw(`create database ${database}${role ? ` owner ${role}` : ""}`)
    .execute(db);
}
