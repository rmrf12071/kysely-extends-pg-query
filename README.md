# kysely-extends-pg-query

`kysely-extends-pg-query` is the plugin of `Kysely`.  
This plugin is developed with `Deno`, and also works `Node.js`(CommonJS).

## Features

- Auto `JSON.stringify` for json/jsonb column(s)
  - To avoid SQL error on `pg-pool` when we use `Array` value to insert/update any column
- Auto updates for specified column(s)
- Utility function for pagination
- Generation Utilities(For Node.js)
  - generete the migration file
- Migration Utilities(For Node.js)
  - `Create Role` and `Create Database`
  - `Migrate To Latest` and `Migrate Down`

## Installation for Node.js

```bash
npm install kysely-extends-pg-query
```

## Import for Deno

"import via npm" is not supported. Please import by url as follows:

```ts
import { ExtendsPgQueryPlugin } from "https://raw.githubusercontent.com/rmrf12071/kysely-extends-pg-query/0.1.7/src/index.ts";
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

## Generation and Migration (for Node.js)

create config file like following:

```ts
import type { UtilConfig } from "kysely-extends-pg-query";

const config: UtilConfig = {
  database: 'test01',
  owner: {
    user: 'test_01',
    password: 'pwd',
  },
  generate: {
    dir: 'db_schema_definition',
    quote: "'",
  };
  migrate: 'migrate', // folder path of migration files
  superUser: {
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  },
};

export default config;
```

add command to run-scripts(package.json)

```json
  "scripts": {
    "migrate:gen": "kysely-extends-pg-query --mode migrate-gen --config config.ts",
    "migrate:init": "kysely-extends-pg-query --mode migrate-init --config config.ts",
    "migrate:latest": "kysely-extends-pg-query --mode migrate-latest --config config.ts",
    "migrate:down": "kysely-extends-pg-query --mode migrate-down --config config.ts"
  },
```

### Generation

Add definition file to `generate` folder.

```ts
import { generator } from "kysely-extends-pg-query";

const table = generator.makeTableDefinition({
  name: "table",
  columns: [
    { name: "key", primary: true, type: "bigserial" },
    { name: "string", notNull: false, type: "text" },
    { name: "string2", notNull: false, type: "char", length: 1 },
    { name: "big_int", notNull: false, type: "bigint" },
    { name: "json", notNull: false, type: "json", structure: "{}[]" },
    { name: "jsonb", notNull: false, type: "jsonb", structure: "{}[]" },
    { name: "ts", notNull: false, type: "timestamp", withTZ: false },
  ],
});

const def: generator.generateExportType = {
  tables: [table],
};

export default def;
```

Full example exists `/test/utils/schema/generator.test.ts`.

To execute command, generate `_generated.ts` in `config.migrate.dir`.

```bash
npm run migrate:gen
```

### Migration

- Create Role and Create Database

```bash
npm run migrate:init
```

- Execute Migration

```bash
# migrate to latest
npm run migrage:latest
# migrate down(rollback)
npm run migrate:down
```
