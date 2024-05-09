import { ColumnType, Generated, Kysely, PostgresDialect } from "kysely";
import PgPool from "pg-pool";
import {
  commentOn,
  createPgDatabase,
  createPgRole,
  createPolicy,
  dropPolicy,
  grantDBObj,
  makePgSystemKysely,
  SystemDatabase,
  updateRowLevelSecurity,
} from "../../../src/index.ts";
import { assertEquals } from "https://deno.land/std@0.201.0/assert/assert_equals.ts";

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

const DB_NAME = "kysely_pg_query_plugin_test_system_utils";
const DB_OWNER = "kysely_pqp";
const DB_USER = "kysely_pqp_u";
const postgres = makePgSystemKysely({
  pool: new PgPool({
    host: "127.0.0.1",
    user: "postgres",
    idleTimeoutMillis: 0,
  }),
});
const db = new Kysely<Database & SystemDatabase>({
  dialect: new PostgresDialect({
    pool: new PgPool({
      database: DB_NAME,
      host: "127.0.0.1",
      user: DB_OWNER,
      idleTimeoutMillis: 0,
    }),
  }),
  log: (event) => {
    console.log(`${event.query.sql}, [${event.query.parameters}]`);
  },
});

Deno.test("system", async () => {
  // check database
  const targetDB = await postgres.selectFrom("pg_database").selectAll().where(
    "datname",
    "=",
    DB_NAME,
  ).executeTakeFirst();

  if (!targetDB) {
    // create database
    try {
      await createPgRole(postgres, DB_OWNER);
    } catch (_) { /* noop */ }
    try {
      await createPgRole(postgres, DB_USER);
    } catch (_) { /* noop */ }
    await createPgDatabase(postgres, DB_NAME, { owner: DB_OWNER });
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

  const getComments = () =>
    db.selectFrom("pg_description as d").innerJoin(
      "pg_class as c",
      "d.objoid",
      "c.oid",
    )
      .select(["d.objsubid", "d.description"]).where("c.relkind", "=", "r")
      .where(
        "c.relname",
        "=",
        "person",
      )
      .orderBy("d.objsubid")
      .execute();

  // add comments
  const tableComment = "test comment for table";
  const columnComment = "test comment for column'";
  await commentOn(db, "table", "person", tableComment);
  await commentOn(db, "column", "person.id", columnComment);
  let comments = await getComments();
  assertEquals(
    comments,
    [
      { objsubid: 0, description: tableComment },
      { objsubid: 1, description: columnComment },
    ],
  );

  // remove comments
  await commentOn(db, "table", "person", null);
  await commentOn(db, "column", "person.id", null);
  comments = await getComments();
  assertEquals(comments, []);

  // grant
  await grantDBObj(
    db,
    "table",
    "select",
    { all: true, schema: "public" },
    DB_USER,
  );
  await grantDBObj(
    db,
    "sequence",
    "usage",
    { all: true, schema: "public" },
    DB_USER,
  );

  // RLS
  await updateRowLevelSecurity(db, "person", "enable");
  await updateRowLevelSecurity(db, "person", "disable");
  await createPolicy(db, "person", { using: "true" });
  await dropPolicy(db, "person");

  await postgres.destroy();
  await db.destroy();
});
