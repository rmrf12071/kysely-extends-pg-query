import { createPgDatabase } from "./schema/system.ts";

export type UtilConfig = {
  /** target database name */
  database: string;
  /** host(IP/domain name), default: localhost */
  host?: string;
  /** port number, default: 5432 */
  port?: number;
  /** target database owner */
  owner: {
    /** database user(role) */
    user: string;
    /** password of user/role */
    password: string;
  };
  /** dir of migrate files */
  migrate: string;
  /** output file for dry migrate */
  dryMigrateOutput?: string;
  /** superuser for system database */
  superUser?: {
    /** superuser name */
    user: string;
    /** superuser password */
    password: string;
    /** superuser database(like "postgres") */
    database: string;
  };
  /** detailed logs output */
  verbose?: boolean;
  /** options for create database */
  createDbOptions?: Parameters<typeof createPgDatabase>[2];
};
