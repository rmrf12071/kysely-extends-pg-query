import { Kysely, PostgresDialect, sql } from "kysely";
import PgPool from "pg-pool";
import { assertEquals } from "https://deno.land/std@0.201.0/assert/mod.ts";
import { ExtendsPgQueryPlugin } from "../../src/index.ts";

interface Database {
  test: {
    id: number;
    users: { name: string }[] | null;
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
    // not null
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
    // null + onConflict(not null)
    const res2 = db.insertInto("test").values({
      id: 0,
      users: null,
      created_at: new Date(0),
    }).onConflict((oc) =>
      oc.column("id").doUpdateSet({
        users: TEST_ARRAY,
        created_at: new Date(1),
      })
    ).compile();
    assertEquals(res2.parameters.length, 5);
    assertEquals(res2.parameters[1], null);
    assertEquals(res2.parameters[3], JSON.stringify(TEST_ARRAY));
  });

  await t.step("insert with raw sql", () => {
    // not null
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
    // null + onConflict(null)
    const res2 = db.insertInto("test").values({
      id: 0,
      users: null,
      created_at: sql`CURRENT_TIMESTAMP`,
    }).onConflict((oc) =>
      oc.column("id").doUpdateSet((eb) => ({
        users: null,
        created_at: eb.ref("excluded.created_at"),
      }))
    ).compile();
    assertEquals(res2.parameters.length, 3);
    assertEquals(res2.parameters[1], null);
    assertEquals(res2.parameters[2], null);
  });

  await t.step("insert multiple", () => {
    const res = db.insertInto("test").values([
      { id: 0, users: TEST_ARRAY, created_at: new Date(0) },
      { id: 1, users: null, created_at: sql`CURRENT_TIMESTAMP` },
    ]).compile();
    assertEquals(res.parameters.length, 5);
    assertEquals(res.parameters[0], 0);
    assertEquals(
      res.parameters[1],
      JSON.stringify(TEST_ARRAY),
    );
    assertEquals(res.parameters[2], new Date(0));
    assertEquals(res.parameters[3], 1);
    assertEquals(res.parameters[4], null);
  });
});

Deno.test("update", async (t) => {
  await t.step("update without table alias", () => {
    // not null
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
    // null
    const res2 = db.updateTable("test").set({
      users: null,
      created_at: new Date(0),
    }).compile();
    assertEquals(res2.parameters[0], null);
  });

  await t.step("update with table alias", () => {
    // not null
    const res = db.updateTable("test as t").set({
      users: TEST_ARRAY,
    }).compile();
    assertEquals(res.parameters.length, 1);
    assertEquals(
      res.parameters[0],
      JSON.stringify(TEST_ARRAY),
    );
    // null
    const res2 = db.updateTable("test as t").set({
      users: null,
      created_at: sql`CURRENT_TIMESTAMP`,
    }).compile();
    assertEquals(res2.parameters[0], null);
  });
});
