import {
  Kysely,
  PostgresCursor,
  PostgresPool,
  PostgresPoolClient,
  PostgresQueryResult,
  QueryResult,
  sql,
} from "kysely";
import PgPool from "pg-pool";

/** add/remove comment on target
 * @param db instance of kysely
 * @param type type of target
 * @param target target name
 * @param comment comment content
 * @returns result
 */
export function commentOn(
  // deno-lint-ignore no-explicit-any
  db: Kysely<any>,
  type:
    | "table"
    | "column"
    | "database"
    | "function"
    | "index"
    | "role"
    | "schema"
    | "sequence"
    | "tablespace"
    | "type"
    | "view",
  target: string,
  comment: string | null,
) {
  const query = `comment on ${type} ${target} is ${
    comment === null ? "null" : `'${comment.replace(/'/g, "''")}'`
  }`;
  return sql.raw(query).execute(db);
}

type tableGrant =
  | "select"
  | "insert"
  | "update"
  | "delete"
  | "truncate"
  | "references"
  | "trigger";
type sequenceGrant = "usage" | "select" | "update";
export function grantDBObj(
  // deno-lint-ignore no-explicit-any
  db: Kysely<any>,
  type: "table",
  grant: tableGrant | "all" | tableGrant[],
  dbObj: { all: false; name: string | string[] } | {
    all: true;
    schema: string | string[];
  },
  role: string | string[],
  withGrantOption?: boolean,
): Promise<QueryResult<unknown>>;
export function grantDBObj(
  // deno-lint-ignore no-explicit-any
  db: Kysely<any>,
  type: "sequence",
  grant: sequenceGrant | "all" | sequenceGrant[],
  dbObj: { all: false; name: string | string[] } | {
    all: true;
    schema: string | string[];
  },
  role: string | string[],
  withGrantOption?: boolean,
): Promise<QueryResult<unknown>>;

/**
 * grant to database object
 * @param db instance of kysely
 * @param type target type
 * @param grant grant content
 * @param dbObj target database object
 * @param role target role
 * @param withGrantOption true=set "with grant option"
 * @returns result
 */
export function grantDBObj(
  // deno-lint-ignore no-explicit-any
  db: Kysely<any>,
  type: "table" | "sequence",
  grant: string | string[],
  dbObj: { all: false; name: string | string[] } | {
    all: true;
    schema: string | string[];
  },
  role: string | string[],
  withGrantOption?: boolean,
) {
  const grants = typeof grant === "string" ? [grant] : grant;
  const roles = typeof role === "string" ? [role] : role;
  const on = (() => {
    const names = dbObj.all === false
      ? typeof dbObj.name === "string" ? [dbObj.name] : dbObj.name
      : typeof dbObj.schema === "string"
      ? [dbObj.schema]
      : dbObj.schema;
    if (dbObj.all === false) return `${type} ${names.join(", ")}`;
    return `all ${type}s in schema ${names.join(", ")}`;
  })();
  const query = `grant ${grants.join(", ")} on ${on} to ${roles.join(", ")}${
    withGrantOption ? " with grant option" : ""
  }`;
  return sql.raw(query).execute(db);
}

/**
 * update row level security
 * @param db instance of kysely
 * @param table table name
 * @param mode RLS mode
 * @returns result
 */
export function updateRowLevelSecurity(
  // deno-lint-ignore no-explicit-any
  db: Kysely<any>,
  table: string,
  mode: "disable" | "enable" | "force" | "no force",
) {
  const query = `alter table ${table} ${mode} row level security`;
  return sql.raw(query).execute(db);
}

/**
 * create policy for row level security
 * @param db instance of kysely
 * @param table table name
 * @param options.name name of policy(default: ${table}_policy)
 * @param options.operation target operation
 * @param options.to target role
 * @param options.using using expression
 * @param options.withCheck check expression
 * @returns result
 */
export function createPolicy(
  // deno-lint-ignore no-explicit-any
  db: Kysely<any>,
  table: string,
  options?: {
    name?: string;
    operation?: "all" | "select" | "insert" | "update" | "delete";
    to?: string | string[];
    using?: string;
    withCheck?: string;
  },
) {
  const name = options?.name ?? `${table}_policy`;
  const operation = options?.operation ? ` for ${options?.operation}` : "";
  const to = !options?.to
    ? ""
    : ` to ${
      typeof options.to === "string" ? options.to : options.to.join(", ")
    }`;
  const using = options?.using ? ` using(${options.using})` : "";
  const withCheck = options?.withCheck
    ? ` with check(${options.withCheck})`
    : "";
  const query =
    `create policy ${name} on ${table}${operation}${to}${using}${withCheck}`;
  return sql.raw(query).execute(db);
}

/**
 * drop policy for row level security
 * @param db instance of kysely
 * @param table table name
 * @param name name of policy(default: ${table}_policy)
 * @returns result
 */
export function dropPolicy(
  // deno-lint-ignore no-explicit-any
  db: Kysely<any>,
  table: string,
  name?: string,
) {
  const query = `drop policy ${name ?? `${table}_policy`} on ${table}`;
  return sql.raw(query).execute(db);
}

/** results of dry run */
export type DryMigrationQueries = {
  sql: string;
  parameters: ReadonlyArray<unknown>;
}[];

/** PgPool for dry mmigration */
export class DryMigrationPgPool implements PostgresPool {
  // deno-lint-ignore no-explicit-any
  #config: PgPool.Config<any>;
  #dryConfig: { queries: DryMigrationQueries };
  #client: DryMigrationPgPoolClient | undefined;

  constructor(
    // deno-lint-ignore no-explicit-any
    config: PgPool.Config<any>,
    dryConfig: { queries: DryMigrationQueries },
  ) {
    this.#config = config;
    this.#dryConfig = dryConfig;
  }
  connect(): Promise<PostgresPoolClient> {
    const client = new DryMigrationPgPoolClient(this.#config, this.#dryConfig);
    this.#client = client;
    return new Promise((resolve) => resolve(client));
  }
  end(): Promise<void> {
    if (!this.#client) return Promise.resolve();
    const client = this.#client;
    this.#client = undefined;
    return client.end();
  }
}
/** PgPoolClient for dry migration */
class DryMigrationPgPoolClient implements PostgresPoolClient {
  #dryConfig: { queries: DryMigrationQueries };
  // deno-lint-ignore no-explicit-any
  #pool: PgPool<any>;
  #migrating = false;

  constructor(
    // deno-lint-ignore no-explicit-any
    config: PgPool.Config<any>,
    dryConfig: { queries: DryMigrationQueries },
  ) {
    this.#dryConfig = dryConfig;
    this.#pool = new PgPool(config);
  }
  query<R>(
    sql: string,
    parameters: ReadonlyArray<unknown>,
  ): Promise<PostgresQueryResult<R>>;
  query<R>(cursor: PostgresCursor<R>): PostgresCursor<R>;
  query<R>(
    sqlOrCursor: string | PostgresCursor<R>,
    parameters?: ReadonlyArray<unknown>,
  ): Promise<PostgresQueryResult<R>> | PostgresCursor<R> {
    if (typeof sqlOrCursor !== "string") {
      return this.#pool.query(
        sqlOrCursor as unknown as string,
      ) as unknown as PostgresCursor<R>;
    }
    if (!this.#migrating) {
      if (sqlOrCursor === "begin") this.#migrating = true;
      return this.#pool.query(
        sqlOrCursor,
        [...(parameters ?? [])],
      ) as unknown as Promise<
        PostgresQueryResult<R>
      >;
    }
    if (sqlOrCursor === "commit" || sqlOrCursor === "rollback") {
      this.#migrating = false;
      return this.#pool.query(
        sqlOrCursor,
        [...(parameters ?? [])],
      ) as unknown as Promise<
        PostgresQueryResult<R>
      >;
    }
    if (sqlOrCursor.startsWith("select pg_advisory_xact_lock(")) {
      return this.#pool.query(
        sqlOrCursor,
        [...(parameters ?? [])],
      ) as unknown as Promise<
        PostgresQueryResult<R>
      >;
    }
    if (
      sqlOrCursor.startsWith("select") &&
      sqlOrCursor.includes("kysely_migration")
    ) {
      return this.#pool.query(
        sqlOrCursor,
        [...(parameters ?? [])],
      ) as unknown as Promise<
        PostgresQueryResult<R>
      >;
    }

    if (!sqlOrCursor.startsWith('insert into "kysely_migration"')) {
      this.#dryConfig.queries.push({
        sql: sqlOrCursor,
        parameters: parameters ?? [],
      });
    }
    return new Promise((resolve) =>
      resolve({ command: "SELECT", rowCount: 0, rows: [] })
    );
  }
  release(): void {}
  end(): Promise<void> {
    return this.#pool.end();
  }
}
