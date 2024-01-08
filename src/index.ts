import ExtendsPgQueryPlugin from "./plugin/extends-pg-query-plugin.ts";
import executePagination, {
  executeTotal,
  validatePagination,
} from "./utils/executePagination.ts";
import {
  createPgDatabase,
  createPgRole,
  makePgSystemKysely,
} from "./utils/schema/system.ts";
export type { Pagination } from "./utils/executePagination.ts";
export type { UtilConfig } from "./utils/config.type.ts";
export * as generator from "./utils/schema/generator.ts";
export type { SystemDatabase } from "./utils/schema/system.ts";

export {
  createPgDatabase,
  createPgRole,
  executePagination,
  executeTotal,
  ExtendsPgQueryPlugin,
  makePgSystemKysely,
  validatePagination,
};
