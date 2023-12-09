import {
  Kysely,
  ReferenceExpression,
  SelectQueryBuilder,
  Transaction,
} from "kysely";
import ClearGroupbyPlugin from "../plugin/clear-groupby-plugin.ts";

type UnpackPromise<T> = T extends Promise<(infer U)> ? U : T;

export type Pagination = { currentPage: number; perPage: number };

function validateNaturalNumber(value: unknown, _default: number) {
  const num = Number(value);
  return isNaN(num) || num <= 0 || !Number.isInteger(num) ? _default : num;
}

/**
 * validate pagination
 * @param pagination unvalidated pagination
 * @param _default currentPage/perPage
 * @returns validated pagination
 */
export function validatePagination(
  pagination: { currentPage: unknown; perPage: unknown },
  _default: Pagination = {
    currentPage: 1,
    perPage: 10,
  },
) {
  const currentPage = validateNaturalNumber(
    pagination.currentPage,
    _default.currentPage,
  );
  const perPage = validateNaturalNumber(pagination.perPage, _default.perPage);
  return { currentPage, perPage };
}

type TotalOptionsType<DB, TB extends keyof DB> = {
  _default?: { limit: number; offset: number };
  distinctKey?: ReferenceExpression<DB, TB>;
  // deno-lint-ignore no-explicit-any
  db?: Kysely<any> | Transaction<any>;
};

// overload: "distinctKey" and "db" cannot be specified at the same time
export async function executeTotal<DB, TB extends keyof DB, O>(
  sqb: SelectQueryBuilder<DB, TB, O>,
  pagination: { limit: number; offset: number },
  options?: Omit<TotalOptionsType<DB, TB>, "db">,
): Promise<
  { data: UnpackPromise<ReturnType<(typeof sqb)["execute"]>>; total: number }
>;
export async function executeTotal<DB, TB extends keyof DB, O>(
  sqb: SelectQueryBuilder<DB, TB, O>,
  pagination: { limit: number; offset: number },
  options?: Omit<TotalOptionsType<DB, TB>, "distinctKey">,
): Promise<
  { data: UnpackPromise<ReturnType<(typeof sqb)["execute"]>>; total: number }
>;

/**
 * executes the query and counts the total
 * @param sqb SelectQueryBuilder
 * @param pagination limit and offset
 * @param options default limit/offset, key of distinct and db/trx
 * @returns selected data and total
 *
 * example
 * ```ts
 * // select "name" from "pet" limit 10 offset 0
 * // select count(*) as "count" from "pet"
 * const { data, total } = await executeTotal(
 *            db.selectFrom("pet").select("name"),
 *            { offset: 0, limit: 10 }
 * );
 *
 * // select "name" from "pet" limit 10 offset 0
 * // select count(*) as "count" from (select "name" from "pet") as "table"
 * const { data, total } = await executeTotal(
 *            db.selectFrom("pet").select("name"),
 *            { offset: 0, limit: 10 },
 *            { db }
 * );
 * ```
 */
export async function executeTotal<DB, TB extends keyof DB, O>(
  sqb: SelectQueryBuilder<DB, TB, O>,
  pagination: { limit: number; offset: number },
  options?: TotalOptionsType<DB, TB>,
): Promise<
  { data: UnpackPromise<ReturnType<(typeof sqb)["execute"]>>; total: number }
> {
  // validate for any/unknown
  const limit = validateNaturalNumber(
    pagination.limit,
    options?._default?.limit ?? 0,
  );
  const offset = validateNaturalNumber(
    pagination.offset,
    options?._default?.offset ?? 0,
  );

  // fetch list
  const listQuery = sqb.limit(limit).offset(offset);
  const data = await listQuery.execute();

  if (
    (data.length > 0 && data.length < limit) ||
    (data.length == 0 && offset == 0)
  ) {
    return {
      data,
      total: offset + data.length,
    };
  }

  const countQuery = (() => {
    if (options?.db) {
      return options.db.selectFrom(() => sqb.as("table")).select((eb) =>
        eb.fn.countAll().as("count")
      );
    }
    return sqb.clearSelect().clearOrderBy().select((
      eb,
    ) => [
      (options?.distinctKey
        ? eb.fn.count(options?.distinctKey).distinct()
        : eb.fn.countAll()).as("count"),
    ]).withPlugin(new ClearGroupbyPlugin());
  })();
  const total = await countQuery.executeTakeFirst();
  if (total && "count" in total) {
    return { data, total: Number(total.count) };
  }

  return {
    data,
    total: offset + data.length,
  };
}

type PaginationOptionsType<DB, TB extends keyof DB> = {
  _default?: { currentPage: number; perPage: number };
  distinctKey?: ReferenceExpression<DB, TB>;
  // deno-lint-ignore no-explicit-any
  db?: Kysely<any> | Transaction<any>;
};

// overload: "distinctKey" and "db" cannot be specified at the same time
export default async function executePagination<DB, TB extends keyof DB, O>(
  sqb: SelectQueryBuilder<DB, TB, O>,
  pagination: { currentPage: number; perPage: number },
  options?: Omit<PaginationOptionsType<DB, TB>, "db">,
): Promise<
  { data: UnpackPromise<ReturnType<(typeof sqb)["execute"]>>; total: number }
>;
export default async function executePagination<DB, TB extends keyof DB, O>(
  sqb: SelectQueryBuilder<DB, TB, O>,
  pagination: { currentPage: number; perPage: number },
  options?: Omit<PaginationOptionsType<DB, TB>, "distinctKey">,
): Promise<
  { data: UnpackPromise<ReturnType<(typeof sqb)["execute"]>>; total: number }
>;

/**
 * executes the query and counts the total
 * @param sqb SelectQueryBuilder
 * @param pagination current page(starts 1) and per page
 * @param options default currentPage/perPage, key of distinct and db/trx
 * @returns selected data and total
 *
 * example
 * ```ts
 * // select "name" from "pet" limit 10 offset 0
 * // select count(*) as "count" from "pet"
 * const { data, total } = await executePagination(
 *            db.selectFrom("pet").select("name"),
 *            { currentPage: 1, perPage: 10 }
 * );
 *
 * // select "name" from "pet" limit 10 offset 0
 * // select count(*) as "count" from (select "name" from "pet") as "table"
 * const { data, total } = await executePagination(
 *            db.selectFrom("pet").select("name"),
 *            { currentPage: 1, perPage: 10 },
 *            { db }
 * );
 * ```
 */
export default function executePagination<DB, TB extends keyof DB, O>(
  sqb: SelectQueryBuilder<DB, TB, O>,
  pagination: { currentPage: number; perPage: number },
  options?: PaginationOptionsType<DB, TB>,
): Promise<
  { data: UnpackPromise<ReturnType<(typeof sqb)["execute"]>>; total: number }
> {
  const { _default, ...restOptions } = options ?? {};
  const { currentPage, perPage } = validatePagination(
    pagination,
    options?._default,
  );
  const offset = (currentPage - 1) * perPage;

  return executeTotal(sqb, { limit: perPage, offset }, restOptions);
}
