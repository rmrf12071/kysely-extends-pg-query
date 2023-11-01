import { ColumnType, Generated, Kysely, PostgresDialect, sql } from "kysely";
import PgPool from "pg-pool";
import { assertEquals } from "https://deno.land/std@0.201.0/assert/mod.ts";
import { ExtendsPgQueryPlugin } from "../../src/index.ts";

interface Database {
  test: {
    id: number;
    users: { name: string }[] | null;
    created_at: Date;
    updated_at: ColumnType<Date, never, Date>;
  };
  test2: {
    id: number;
    foo: string;
    updated_at: ColumnType<Date, never, never>;
  };
  test3: {
    id: Generated<number>;
    users: { name: string }[] | null;
    foo: string | null;
  };
  test4: {
    id: Generated<number>;
    foo: string | null;
    updated_at: ColumnType<Date, never, never>;
  };
  test5: {
    id: Generated<number>;
  };
}

const dialect = new PostgresDialect({ pool: new PgPool() });
const db = new Kysely<Database>({
  dialect,
  plugins: [
    new ExtendsPgQueryPlugin<Database>({
      jsonColumns: ["test.users", "test3.users"],
      autoUpdates: {
        "test.updated_at": "DEFAULT",
        "test2.updated_at": "CURRENT_TIMESTAMP",
        "test4.updated_at": "DEFAULT",
      },
    }),
  ],
});
const TEST_ARRAY = [{ name: "alice" }, { name: "bob" }];

Deno.test("json:insert", async (t) => {
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

  await t.step("insert no json", () => {
    const res = db.insertInto("test3").values([
      { id: 0, created_at: new Date(0) },
    ]).compile();
    assertEquals(
      res.sql,
      'insert into "test3" ("id", "created_at") values ($1, $2)',
    );
  });
});

Deno.test("json:update", async (t) => {
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

Deno.test("auto update", async (t) => {
  await t.step("if not specified, auto update", () => {
    const res = db.updateTable("test").set({
      users: null,
    }).compile();
    assertEquals(res.sql.includes('"updated_at" = DEFAULT'), true);
  });
  await t.step("if specified, no auto update", () => {
    const res = db.updateTable("test").set({
      users: null,
      updated_at: new Date(),
    }).compile();
    assertEquals(res.parameters.length, 2);
    assertEquals(res.sql.includes('"updated_at" = DEFAULT'), false);
  });
  await t.step("auto update for no json table", () => {
    const res = db.updateTable("test2").set({
      foo: "bar",
    }).compile();
    assertEquals(res.parameters.length, 1);
    assertEquals(res.sql.includes('"updated_at" = CURRENT_TIMESTAMP'), true);
  });
  await t.step("auto update on conflict", () => {
    const res = db.insertInto("test").values({
      id: 1,
      users: null,
      created_at: new Date(),
    }).onConflict((oc) => oc.column("id").doUpdateSet({}).where("id", "=", 1))
      .compile();
    assertEquals(res.sql.includes('"updated_at" = DEFAULT'), true);
  });
  await t.step("auto update on conflict (no json column)", () => {
    const res = db.insertInto("test2").values({
      id: 1,
      foo: "",
    }).onConflict((oc) =>
      oc.column("id").doUpdateSet({ foo: "bar" }).where("id", "=", 1)
    )
      .compile();
    assertEquals(res.sql.includes('"updated_at" = CURRENT_TIMESTAMP'), true);
  });
});

Deno.test("other", async (t) => {
  await t.step("no json & auto update", () => {
    const res1 = db.insertInto("test4").values({ id: 1 }).onConflict((oc) =>
      oc.column("id").doUpdateSet({ foo: "bar" })
    ).compile();
    assertEquals(
      res1.sql,
      'insert into "test4" ("id") values ($1) on conflict ("id") do update set "foo" = $2, "updated_at" = DEFAULT',
    );
    const res2 = db.updateTable("test4").set({ id: 1 }).compile();
    assertEquals(
      res2.sql,
      'update "test4" set "id" = $1, "updated_at" = DEFAULT',
    );
  });

  await t.step("no json & no auto update", () => {
    const res1 = db.insertInto("test5").values({ id: 1 }).compile();
    assertEquals(res1.sql, 'insert into "test5" ("id") values ($1)');
    const res2 = db.updateTable("test5").set({ id: 1 }).compile();
    assertEquals(res2.sql, 'update "test5" set "id" = $1');
  });
});
