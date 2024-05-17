# kysely-extends-pg-query

`kysely-extends-pg-query` is the plugin of `Kysely`.  
This plugin is developed with `Deno`, and also works `Node.js`(CommonJS).

## Features

- Auto `JSON.stringify` for json/jsonb column(s)
  - To avoid SQL error on `pg-pool` when we use `Array` value to insert/update any column
- Auto updates for specified column(s)
- Utility function for pagination
- Commands for Node.js: migration

## Installation for Node.js

```bash
npm install kysely-extends-pg-query
```

## Import for Deno

"import via npm" is not supported. Please import by url as follows:

```ts
import { ExtendsPgQueryPlugin } from "https://raw.githubusercontent.com/rmrf12071/kysely-extends-pg-query/0.2.4/src/index.ts";
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
