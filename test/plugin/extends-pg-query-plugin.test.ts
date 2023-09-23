import { Kysely, PostgresDialect, sql } from "kysely";
import PgPool from "pg-pool";
import { assertEquals } from "https://deno.land/std@0.201.0/assert/mod.ts";
import { ExtendsPgQueryPlugin } from "../../src/index.ts";

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
    new ExtendsPgQueryPlugin<Database>({ jsonColumns: ["test.users"] }),
  ],
});
const TEST_ARRAY = [{ name: "alice" }, { name: "bob" }];

Deno.test("insert", async (t) => {
  await t.step("insert only primitive", () => {
    const res = db.insertInto("test").values({
      id: 0,
      users: TEST_ARRAY,
      created_at: new Date(0),
    }).compile();
    assertEquals(res.parameters.length, 3);
    assertEquals(res.parameters[0], 0);
    assertEquals(
      res.parameters[1],
      JSON.stringify(TEST_ARRAY),
    );
    assertEquals(res.parameters[2], new Date(0));
  });

  await t.step("insert with raw sql", () => {
    const res = db.insertInto("test").values({
      id: 0,
      users: TEST_ARRAY,
      created_at: sql`CURRENT_TIMESTAMP`,
    }).compile();
    assertEquals(res.parameters.length, 2);
    assertEquals(res.parameters[0], 0);
    assertEquals(
      res.parameters[1],
      JSON.stringify(TEST_ARRAY),
    );
  });
});

Deno.test("update", async (t) => {
  await t.step("update without table alias", () => {
    const res = db.updateTable("test").set({
      users: TEST_ARRAY,
      created_at: new Date(0),
    }).compile();
    assertEquals(res.parameters.length, 2);
    assertEquals(
      res.parameters[0],
      JSON.stringify(TEST_ARRAY),
    );
    assertEquals(res.parameters[1], new Date(0));
  });

  await t.step("update with table alias", () => {
    const res = db.updateTable("test as t").set({
      users: TEST_ARRAY,
    }).compile();
    assertEquals(res.parameters.length, 1);
    assertEquals(
      res.parameters[0],
      JSON.stringify(TEST_ARRAY),
    );
  });
});
