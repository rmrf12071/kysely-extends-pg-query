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
import {
  commentOn,
  createPolicy,
  dropPolicy,
  grantDBObj,
  updateRowLevelSecurity,
} from "./utils/schema/utils.ts";
export type { Pagination } from "./utils/executePagination.ts";
export type { UtilConfig } from "./utils/config.type.ts";
export type { SystemDatabase } from "./utils/schema/system.ts";

export {
  commentOn,
  createPgDatabase,
  createPgRole,
  createPolicy,
  dropPolicy,
  executePagination,
  executeTotal,
  ExtendsPgQueryPlugin,
  grantDBObj,
  makePgSystemKysely,
  updateRowLevelSecurity,
  validatePagination,
};
