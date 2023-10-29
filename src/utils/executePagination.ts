import { ReferenceExpression, SelectQueryBuilder } from "kysely";

/**
 * validate pagination
 * @param pagination unvalidated pagination
 * @param _default currentPage/perPage
 * @returns validated pagination
 */
export function validatePagination(
  pagination: { currentPage: unknown; perPage: unknown },
  _default: { currentPage: number; perPage: number } = {
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

/**
 * executes the query and counts the total
 * @param sqb SelectQueryBuilder
 * @param pagination current page(starts 1) and per page
 * @param options default currentPage/perPage and key of distinct
 * @returns selected data and total
 *
 * example
 * ```ts
 * const { data, total } = await executePagination(
 *            db.selectFrom("pet").select("name"),
 *            { currentPage: 1, perPage: 10 }
 * );
 * ```
 */
export default async function executePagination<DB, TB extends keyof DB>(
  sqb: SelectQueryBuilder<DB, TB, unknown>,
  pagination: { currentPage: number; perPage: number },
  options?: {
    _default?: { currentPage: number; perPage: number };
    distinctKey?: ReferenceExpression<DB, TB>;
  },
) {
  const { currentPage, perPage } = validatePagination(
    pagination,
    options?._default,
  );
  const offset = (currentPage - 1) * perPage;
  const listQuery = sqb.limit(perPage).offset(offset);
  const data = await listQuery.execute();

  if (data.length > 0 && data.length < perPage) {
    return {
      data,
      total: offset + data.length,
    };
  }

  const countQuery = sqb.clearSelect().select((
    eb,
  ) => [
    (!options?.distinctKey
      ? eb.fn.countAll()
      : eb.fn.count(options?.distinctKey).distinct()).as("count"),
  ]);
  const total = await countQuery.executeTakeFirst();
  if (total && "count" in total) {
    return { data, total: Number(total.count) };
  }

  return {
    data,
    total: offset + data.length,
  };
}
