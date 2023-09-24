# kysely-extends-pg-query

`kysely-extends-pg-query` is the plugin of `Kysely`.  
This plugin is developed with `Deno`, and will also works `Node.js`.

## Features

- Auto `JSON.stringify` for json/jsonb column(s)
  - To avoid SQL error on `pg-pool` when we use `Array` value to insert/update any column

## Installation (Node.js)

```
npm install kysely-extends-pg-query
```

## Usage Example

The following example is a part of [test code](./test/plugin/extends-pg-query-plugin.test.ts).

```ts
interface Database {
  test: {
    id: number;
    users: { name: string }[];
    created_at: Date;
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
      jsonColumns: ["test.users"]
    }),
  ],
});
```
