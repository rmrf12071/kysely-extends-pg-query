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
  const query = `comment on ${type} ${target} is ${
    comment === null ? "null" : `'${comment.replace(/'/g, "''")}'`
  }`;
  return sql.raw(query).execute(db);
}
