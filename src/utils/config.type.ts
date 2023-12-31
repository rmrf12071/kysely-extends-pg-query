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
  generate: {
    /** dir of definition files for generation */
    dir: string;
    /** string quotation, default: `"` */
    quote?: '"' | "'";
  };
  /** dir of migrate files */
  migrate: string;
  /** superuser for system database */
  superUser?: {
    /** superuser name */
    user: string;
    /** superuser password */
    password: string;
    /** superuser database(like "postgres") */
    database: string;
  };
};
