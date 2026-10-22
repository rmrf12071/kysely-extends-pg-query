# kysely-extends-pg-query

`kysely-extends-pg-query` is the plugin of `Kysely`.  
This plugin is developed with Node.js and TypeScript, and published as CommonJS.

## Features

- Auto `JSON.stringify` for json/jsonb column(s)
  - To avoid SQL error on `pg-pool` when we use `Array` value to insert/update any column
- Auto updates for specified column(s)
- Utility function for pagination
- Commands for Node.js: migration

Requires Node.js v22 or later. Development and builds require Node.js v24 or later.

## Installation for Node.js

```bash
npm install kysely-extends-pg-query
```

## Usage Example

### Plugin

```ts
interface Database {
  test: {
    id: number;
    users: { name: string }[];
    created_at: ColumnType<Date, never, never>;
    updated_at: ColumnType<Date, never, never>;
  };
  test2: {
    foo: string;
  };
}

const dialect = new PostgresDialect({ pool: new PgPool() });
const db = new Kysely<Database>({
  dialect,
  plugins: [
    new ExtendsPgQueryPlugin<Database>({
      jsonColumns: ["test.users"],
      autoUpdates: [{ "test.updated_at": "DEFAULT" }],
    }),
  ],
});
```

### Pagination

```ts
// select "name" from "pet" limit 10 offset 0
// select count(*) as "count" from "pet"
const { data, total } = await executePagination(
  db.selectFrom("pet").select("name"),
  { currentPage: 1, perPage: 10 }
);

// select "name" from "pet" limit 10 offset 0
// select count(*) as "count" from (select "name" from "pet") as "table"
const { data, total } = await executePagination(
  db.selectFrom("pet").select("name"),
  { currentPage: 1, perPage: 10 },
  { db }
);

// select "name" from "pet" limit 10 offset 0
// select count(*) as "count" from "pet"
const { data, total } = await executeTotal(
  db.selectFrom("pet").select("name"),
  { offset: 0, limit: 10 }
);
```

### Node.js: Migration

config.ts

```ts
import type { UtilConfig } from 'kysely-extends-pg-query';

const config: UtilConfig = {
  database: 'test01',
  host: 'localhost',
  port: 5432,
  ssl: undefined,
  owner: {
    user: 'test_01',
    password: 'pwd',
  },
  migrate: 'migrate',
  dryMigrateOutput: undefined,
  superUser: {
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  },
  verbose: true,
  createDbOptions: undefined,
};

export default config;
```

package.json

```json
  "scripts": {
    "migrate:init": "kysely-extends-pg-query --mode migrate-init --config config.ts",
    "migrate:latest": "kysely-extends-pg-query --mode migrate-latest --config config.ts",
    "migrate:latest-dry": "kysely-extends-pg-query --mode migrate-latest --config config.ts --dry",
    "migrate:down": "kysely-extends-pg-query --mode migrate-down --config config.ts"
  },
```

Then, you can use `npm run migrate:init` and more.  
NOTE: Migration reads folders recursively.

<details>
  <summary>Other features</summary>

  ```ts
    await commentOn(db, "table", "person", "test comment for table");
    await commentOn(db, "table", "person", null);
    await grantDBObj(db, "table", "select", { all: true, schema: "public" }, "target_role_name");
    await updateRowLevelSecurity(db, "person", "enable");
    await createPolicy(db, "person", { using: "true" });
    await dropPolicy(db, "person");
  ```
</details>

## Development: tests

Tests run directly from TypeScript on Node.js v24 or later using `node:test`
and `node:assert/strict`. Builds also run on Node.js v24 or later.

```bash
npm ci
npm run test:unit   # Plugin tests; no PostgreSQL required
npm run test:types  # Type-check source and tests without emitting files
npm run test:simple # All tests; requires local PostgreSQL
npm test           # All tests with experimental Node.js coverage
```

The database tests connect to PostgreSQL at `127.0.0.1` as `postgres`,
without an explicit password. They create test databases
`kysely_pg_query_plugin_test` and `kysely_pg_query_plugin_test_system_utils`
and roles `kysely_pqp` and `kysely_pqp_u`. Use a disposable development
PostgreSQL instance. Existing test databases can affect subsequent runs.

Start a disposable PostgreSQL instance with Docker Compose:

```bash
docker compose up -d --wait
npm run test:simple
docker compose down
```

The service listens on `127.0.0.1:5432` and uses passwordless authentication
for local tests. Database data is stored in tmpfs and discarded when the
container stops. To start fresh, run `docker compose down` followed by
`docker compose up -d --wait`.

Build the CommonJS package and type declarations with `npm run build`.
The output is written to `dist/`; source files and Git state are left untouched.

The npm package is distributed as CommonJS only, with TypeScript declarations.
Both CommonJS and ESM applications can use the named API:

```js
// CommonJS
const { ExtendsPgQueryPlugin } = require("kysely-extends-pg-query");
```

```js
// ESM
import { ExtendsPgQueryPlugin } from "kysely-extends-pg-query";
```

Run `npm run test:package` to build and check CommonJS loading, ESM named
imports, and the declaration entry point. No PostgreSQL is required.
