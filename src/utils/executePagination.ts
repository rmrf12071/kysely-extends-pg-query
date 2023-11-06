import {
  Kysely,
  ReferenceExpression,
  SelectQueryBuilder,
  Transaction,
} from "kysely";

type UnpackPromise<T> = T extends Promise<(infer U)> ? U : T;

export type Pagination = { currentPage: number; perPage: number };

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
  const nums = [Number(pagination.currentPage), Number(pagination.perPage)];
  const currentPage =
    isNaN(nums[0]) || nums[0] <= 0 || !Number.isInteger(nums[0])
      ? _default.currentPage
      : nums[0];
  const perPage = isNaN(nums[1]) || nums[1] <= 0 || !Number.isInteger(nums[1])
    ? _default.perPage
    : nums[1];
  return { currentPage, perPage };
}

// overload: "distinctKey" and "db" cannot be specified at the same time
export default async function executePagination<DB, TB extends keyof DB, O>(
  sqb: SelectQueryBuilder<DB, TB, O>,
  pagination: { currentPage: number; perPage: number },
  options?: {
    _default?: { currentPage: number; perPage: number };
    distinctKey?: ReferenceExpression<DB, TB>;
  },
): Promise<
  { data: UnpackPromise<ReturnType<(typeof sqb)["execute"]>>; total: number }
>;
export default async function executePagination<DB, TB extends keyof DB, O>(
  sqb: SelectQueryBuilder<DB, TB, O>,
  pagination: { currentPage: number; perPage: number },
  options?: {
    _default?: { currentPage: number; perPage: number };
    db?: Kysely<DB> | Transaction<DB>;
  },
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
export default async function executePagination<DB, TB extends keyof DB, O>(
  sqb: SelectQueryBuilder<DB, TB, O>,
  pagination: { currentPage: number; perPage: number },
  options?: {
    _default?: { currentPage: number; perPage: number };
    distinctKey?: ReferenceExpression<DB, TB>;
    db?: Kysely<DB> | Transaction<DB>;
  },
): Promise<
  { data: UnpackPromise<ReturnType<(typeof sqb)["execute"]>>; total: number }
> {
  const { currentPage, perPage } = validatePagination(
    pagination,
    options?._default,
  );
  const offset = (currentPage - 1) * perPage;
  const listQuery = sqb.limit(perPage).offset(offset);
  const data = await listQuery.execute();

  if (
    (data.length > 0 && data.length < perPage) ||
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
      (!options?.distinctKey
        ? eb.fn.countAll()
        : eb.fn.count(options?.distinctKey).distinct()).as("count"),
    ]);
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
