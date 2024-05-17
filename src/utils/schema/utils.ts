import { Kysely, QueryResult, sql } from "kysely";

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
  target = type === "column"
    ? `"${target.split(".").join('"."')}"`
    : `${target}`;
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
    if (dbObj.all === false) return `${type} "${names.join('", "')}"`;
    return `all ${type}s in schema "${names.join('", "')}"`;
  })();
  const query = `grant ${grants.join(", ")} on ${on} to "${
    roles.join('", "')
  }"${withGrantOption ? " with grant option" : ""}`;
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
  const query = `alter table "${table}" ${mode} row level security`;
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
      typeof options.to === "string"
        ? `"${options.to}"`
        : `"${options.to.join('", "')}"`
    }`;
  const using = options?.using ? ` using(${options.using})` : "";
  const withCheck = options?.withCheck
    ? ` with check(${options.withCheck})`
    : "";
  const query =
    `create policy "${name}" on "${table}"${operation}${to}${using}${withCheck}`;
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
  const query = `drop policy "${name ?? `${table}_policy`}" on "${table}"`;
  return sql.raw(query).execute(db);
}
