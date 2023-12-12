import { ColumnType, Generated, Kysely, PostgresDialect, sql } from "kysely";
import PgPool from "pg-pool";
import {
  executePagination,
  executeTotal,
  validatePagination,
} from "../../src/index.ts";
import { assertEquals } from "https://deno.land/std@0.201.0/assert/assert_equals.ts";

interface SystemDatabase {
  pg_database: {
    datname: string;
  };
}
// from getting started of kysely
export interface Database {
  person: {
    id: Generated<number>;
    first_name: string;
    gender: "man" | "woman" | "other";
    last_name: string | null;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  pet: {
    id: Generated<number>;
    name: string;
    owner_id: number;
    species: "dog" | "cat";
  };
}

const DB_NAME = "kysely_pg_query_plugin_test";
const DB_USER = "kysely_pqp";
const postgres = new Kysely<SystemDatabase>({
  dialect: new PostgresDialect({
    pool: new PgPool({
      host: "127.0.0.1",
      user: "postgres",
      idleTimeoutMillis: 0,
    }),
  }),
});
const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new PgPool({
      database: DB_NAME,
      host: "127.0.0.1",
      user: DB_USER,
      idleTimeoutMillis: 0,
    }),
  }),
  log: (event) => {
    console.log(`${event.query.sql}, ${event.query.parameters}`);
  },
});

Deno.test("executePagination", async () => {
  // check database
  const targetDB = await postgres.selectFrom("pg_database").selectAll().where(
    "datname",
    "=",
    DB_NAME,
  ).executeTakeFirst();

  if (!targetDB) {
    // create database
    await sql.raw(`create role ${DB_USER} login`).execute(postgres);
    await sql.raw(`create database ${DB_NAME} owner ${DB_USER}`).execute(
      postgres,
    );
    await db.schema.createTable("person").addColumn(
      "id",
      "serial",
      (col) => col.primaryKey(),
    )
      .addColumn("first_name", "varchar", (col) => col.notNull())
      .addColumn("last_name", "varchar")
      .addColumn("gender", "varchar")
      .addColumn("created_at", "timestamptz")
      .execute();
    await db.schema.createTable("pet").addColumn(
      "id",
      "serial",
      (col) => col.primaryKey(),
    )
      .addColumn("name", "varchar", (col) => col.notNull())
      .addColumn("owner_id", "integer", (col) => col.notNull())
      .addColumn("species", "varchar", (col) => col.notNull())
      .addForeignKeyConstraint("owner_id_foreign", ["owner_id"], "person", [
        "id",
      ])
      .execute();

    // create data
    await db.insertInto("person").values([
      { first_name: "Alice", gender: "man" },
      { first_name: "Bob", gender: "man" },
    ]).execute();
    await db.insertInto("pet").values([
      { name: "Ace", owner_id: 2, species: "dog" },
      { name: "Lucy", owner_id: 1, species: "cat" },
      { name: "Gigi", owner_id: 1, species: "cat" },
      { name: "Mia", owner_id: 1, species: "cat" },
      { name: "Sandy", owner_id: 1, species: "cat" },
      { name: "Olive", owner_id: 1, species: "cat" },
    ]).execute();
  }

  // validate pagination
  const v1 = validatePagination({ currentPage: 0, perPage: "100" });
  assertEquals(v1.currentPage, 1);
  assertEquals(v1.perPage, 100);
  const v2 = validatePagination({ currentPage: "abc", perPage: 5n }, {
    currentPage: 3,
    perPage: 10,
  });
  assertEquals(v2.currentPage, 3);
  assertEquals(v2.perPage, 5);
  const v3 = validatePagination({ currentPage: "5", perPage: "abc" }, {
    currentPage: 3,
    perPage: 10,
  });
  assertEquals(v3.currentPage, 5);
  assertEquals(v3.perPage, 10);
  const v4 = validatePagination({ currentPage: 2, perPage: 20 });
  assertEquals(v4.currentPage, 2);
  assertEquals(v4.perPage, 20);

  // first page(limit/offset)
  await (async () => {
    const res = await executeTotal(
      db.selectFrom("pet").select("name").where("owner_id", "=", 1),
      { offset: 0, limit: 3 },
    );
    assertEquals(res.data.length, 3);
    assertEquals(res.total, 5);
  })();

  // currentPage=0(out of range) -> currentPage=1
  await (async () => {
    const res = await executePagination(db.selectFrom("pet").select("name"), {
      currentPage: 0,
      perPage: 10,
    });
    assertEquals(res.data.length, 6);
    assertEquals(res.total, 6);
  })();

  // currentPage=100(out of range)
  await (async () => {
    const res = await executePagination(db.selectFrom("pet").select("name"), {
      currentPage: 100,
      perPage: 10,
    });
    assertEquals(res.data.length, 0);
    assertEquals(res.total, 6);
  })();

  // first page
  await (async () => {
    const res = await executePagination(
      db.selectFrom("pet").select("name").where("owner_id", "=", 1),
      { currentPage: 1, perPage: 3 },
    );
    assertEquals(res.data.length, 3);
    assertEquals(res.total, 5);
  })();

  // first page(order by+group by)
  await (async () => {
    const res = await executePagination(
      db.selectFrom("pet").select("name").where("owner_id", "=", 1).orderBy(
        "id",
      ).groupBy("id"),
      { currentPage: 1, perPage: 3 },
    );
    assertEquals(res.data.length, 3);
    assertEquals(res.total, 5);
  })();

  // last page
  await (async () => {
    const res = await executePagination(
      db.selectFrom("pet").select("name").where("owner_id", "=", 1),
      { currentPage: 2, perPage: 3 },
    );
    assertEquals(res.data.length, 2);
    assertEquals(res.total, 5);
  })();

  // distinct
  await (async () => {
    const res = await executePagination(
      db.selectFrom("pet").select("species").distinct(),
      { currentPage: 1, perPage: 3 },
      { distinctKey: "species" },
    );
    assertEquals(res.data.length, 2);
    assertEquals(res.total, 2);
  })();

  // distinct with count
  await (async () => {
    const res = await executePagination(
      db.selectFrom("pet").select("species").distinct(),
      { currentPage: 1, perPage: 1 },
      { distinctKey: "species" },
    );
    assertEquals(res.data.length, 1);
    assertEquals(res.total, 2);
  })();

  // no data
  await (async () => {
    const res = await executePagination(
      db.selectFrom("pet").select("name").where("owner_id", "=", 3),
      { currentPage: 1, perPage: 5 },
    );
    assertEquals(res.data.length, 0);
    assertEquals(res.total, 0);
  })();

  // sub query
  await (async () => {
    const res = await executePagination(
      db.selectFrom("pet").select("name").where("owner_id", "=", 1),
      { currentPage: 1, perPage: 3 },
      { db },
    );
    assertEquals(res.data.length, 3);
    assertEquals(res.total, 5);
  })();

  // sub query with alias
  await (async () => {
    const res = await executePagination(
      db.selectFrom("pet as p").select("name").where("p.owner_id", "=", 1),
      { currentPage: 1, perPage: 3 },
      { db },
    );
    assertEquals(res.data.length, 3);
    assertEquals(res.total, 5);
  })();

  await postgres.destroy();
  await db.destroy();
});
