import { generator } from "../../../src/index.ts";

Deno.test("foo", async () => {
  const EnumFoo = generator.makeEnumDefinition({
    name: "foo",
    values: ["bar", "piyo"] as const,
  });
  const EnumHoge = generator.makeEnumDefinition({
    name: "hoge",
    values: ["fuga", "piyo"] as const,
  });

  const table = generator.makeTableDefinition({
    name: "table",
    columns: [
      { name: "col1", primary: true, type: "serial" },
      {
        name: "col2",
        type: "enum",
        notNull: false,
        enum: "hoge",
        default: "fuga",
      } as generator.DefineColumn<"col2", typeof EnumHoge>,
      { name: "col3", notNull: false, type: "timestamp", withTZ: true },
      { name: "col4", notNull: false, type: "varchar", length: 100 },
      { name: "col5", notNull: true, type: "integer", index: "unique" },
      { name: "col6", notNull: true, type: "integer" },
      { name: "col7", notNull: true, type: "integer" },
      { name: "col8", notNull: true, type: "boolean", default: false },
    ],
    indexes: [
      { columns: ["col1", "col2"], type: "simple", name: "test001" },
      { columns: ["col6"], type: "simple" },
      { columns: ["col7"], type: "unique" },
    ],
  });
  const table2 = generator.makeTableDefinition({
    name: "table2",
    columns: [
      { name: "key", primary: true, type: "serial" },
    ],
  });
  const table3 = generator.makeTableDefinition({
    name: "table3",
    columns: [
      { name: "key", primary: true, type: "serial" },
    ],
  });
  const table4 = generator.makeTableDefinition({
    name: "table4",
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
  const fk1 = generator.makeForeignKeyDefinition(
    {
      foreignKey: { table: "table2", columns: ["key"] },
      reference: { table: "table", columns: ["col1"] },
    },
    table2,
    table,
  );
  const fk2 = generator.makeForeignKeyDefinition(
    {
      foreignKey: {
        table: "table3",
        columns: ["key"],
        onDelete: "cascade",
        onUpdate: "restrict",
      },
      reference: { table: "table", columns: ["col1"] },
    },
    table3,
    table,
  );

  // todo: overwrite file
  console.log(
    generator.generateMigrate({
      enums: [EnumFoo, EnumHoge],
      tables: [table, table2, table3, table4],
      foreignKeys: [fk1, fk2],
    }),
  );

  const generated = await import("./generated.ts");

  await generated.up(111);

  // todo: check

  await generated.down(111);
});

// select typname as enum, array_agg(pe.enumlabel) as label from pg_type pt join pg_enum pe on pt.oid = pe.enumtypid group by typname;
// select * from pg_tables where schemaname='public';
/*
test01=# select attr.attname, t.typname, attr.atttypmod from pg_attribute attr join pg_type t on attr.atttypid=t.oid where attr.attrelid=(select oid from pg_class where relname='table') and attr.attnum > 0 order by attr.attnum;
 attname |  typname  | atttypmod
---------+-----------+-----------
 col1    | int4      |        -1    // serial
 col2    | hoge      |        -1    // enum(hoge)
 col3    | timestamp |        -1    // timestamp with timezone
 col4    | varchar   |       104    // varchar(100)
 col5    | int4      |        -1    // integer
 col6    | int4      |        -1    // integer
 col7    | int4      |        -1    // integer
 col8    | bool      |        -1    // boolean
(8 行)


test01=# select attr.attname, t.typname, attr.atttypmod from pg_attribute attr join pg_type t on attr.atttypid=t.oid where attr.attrelid=(select oid from pg_class where relname='table4') and attr.attnum > 0 order by attr.attnum;
 attname |  typname  | atttypmod
---------+-----------+-----------
 key     | int8      |        -1    // bigserial
 string  | text      |        -1    // text
 string2 | bpchar    |         5    // char(1)
 big_int | int8      |        -1    // bigint
 json    | json      |        -1    // json
 jsonb   | jsonb     |        -1    // jsonb
 ts      | timestamp |        -1    // timestamp
(7 行)
*/
// select attr.attname, t.typname, attr.atttypmod, attr.attnotnull, attr.atthasdef from pg_attribute attr join pg_type t on attr.atttypid=t.oid where attr.attrelid=(select oid from pg_class where relname='table') and attr.attnum > 0 order by attr.attnum;
