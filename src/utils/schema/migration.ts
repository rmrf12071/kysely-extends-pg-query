import {
  PostgresCursor,
  PostgresPool,
  PostgresPoolClient,
  PostgresQueryResult,
} from "kysely";
import PgPool from "pg-pool";

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
