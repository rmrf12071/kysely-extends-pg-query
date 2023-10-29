# kysely-extends-pg-query

`kysely-extends-pg-query` is the plugin of `Kysely`.  
This plugin is developed with `Deno`, and also works `Node.js`(CommonJS).

## Features

- Auto `JSON.stringify` for json/jsonb column(s)
  - To avoid SQL error on `pg-pool` when we use `Array` value to insert/update any column
- Auto updates for specified column(s)
- Utility function for pagination

## Installation for Node.js

```bash
npm install kysely-extends-pg-query
```

## Import for Deno

"import via npm" is not supported. Please import by url as follows:

```ts
import { ExtendsPgQueryPlugin } from "https://raw.githubusercontent.com/rmrf12071/kysely-extends-pg-query/0.0.2/src/index.ts";
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
 const { data, total } = await executePagination(
    db.selectFrom("pet").select("name"),
    { currentPage: 1, perPage: 10 }
 );
```
