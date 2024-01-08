export type DefineTable<
  T extends string,
  U extends DefineEnum,
  V extends DefineColumn<string, U>,
> = {
  name: T;
  columns: ReadonlyArray<V>;
  indexes?: {
    columns: ReadonlyArray<V>[number]["name"][];
    type: "simple" | "unique";
    name?: string;
  }[];
};
export type DefineColumn<
  T extends string = string,
  U extends DefineEnum = { name: ""; values: [] },
> =
  & {
    name: T;
    index?: "simple" | "unique";
  }
  & (
    { notNull: boolean; primary?: undefined } | {
      notNull?: undefined;
      primary: true;
    }
  )
  & (
    | DefineColumnBoolean
    | DefineColumnSerial
    | DefineColumnInt
    | DefineColumnText
    | DefineColumnEnum<U>
    | DefineColumnTimeStamp
    | DefineColumnChar
    | DefineColumnJson
  );
export type DefineColumnBoolean = {
  type: "boolean";
  default?: boolean;
};
export type DefineColumnSerial = {
  type: "serial" | "bigserial";
};
export type DefineColumnInt = {
  type: "integer" | "bigint";
  default?: number;
};
export type DefineColumnText = {
  type: "text";
  default?: "";
};
export type DefineColumnJson = {
  type: "json" | "jsonb";
  structure: string;
  default?: unknown;
};
export type DefineEnum = {
  readonly name: string;
  readonly values: ReadonlyArray<string>;
};

export type DefineColumnEnum<T extends DefineEnum> = {
  type: "enum";
  enum: T["name"];
  default?: T["values"][number];
};
export type DefineColumnTimeStamp = {
  type: "timestamp";
  withTZ: boolean;
  default?: "now()";
};
export type DefineColumnChar = {
  type: "char" | "varchar";
  length: number | null;
  default?: string;
  option?: ReadonlyArray<string>;
};

export function makeEnumDefinition<
  T extends string,
  U extends ReadonlyArray<string>,
>(
  arg: { name: T; values: U },
) {
  return arg;
}

export function makeTableDefinition<
  T extends string,
  U extends string,
  V extends DefineEnum,
  W extends DefineColumn<U, V>,
>(tbl: DefineTable<T, V, W>) {
  return tbl;
}

export function makeForeignKeyDefinition<
  T1 extends string,
  U1 extends string,
  V1 extends DefineEnum,
  W1 extends DefineColumn<U1, V1>,
  T2 extends string,
  U2 extends string,
  V2 extends DefineEnum,
  W2 extends DefineColumn<U2, V2>,
>(
  fk: {
    foreignKey: {
      table: DefineTable<T1, V1, W1>["name"];
      columns: DefineTable<T1, V1, W1>["columns"][number]["name"][];
      onDelete?: "set null" | "set default" | "cascade" | "restrict";
      onUpdate?: "set null" | "set default" | "cascade" | "restrict";
    };
    reference: {
      table: DefineTable<T2, V2, W2>["name"];
      columns: DefineTable<T2, V2, W2>["columns"][number]["name"][];
    };
    name?: string;
  },
  _fkt: DefineTable<T1, V1, W1>,
  _reft: DefineTable<T2, V2, W2>,
) {
  return fk;
}

export type generateExportType = {
  enums?: DefineEnum[];
  tables?: DefineTable<
    string,
    DefineEnum,
    DefineColumn<string, DefineEnum>
  >[];
  foreignKeys?: Parameters<typeof makeForeignKeyDefinition>[0][];
};

export function generateMigrate(
  { enums, tables, foreignKeys, quote = '"' }: generateExportType & {
    quote?: '"' | "'";
  },
) {
  const migratesUp: string[] = [];
  const migratesDown: string[] = [];

  // create enum
  if (enums) {
    for (let i = 0; i < enums.length; i++) {
      migratesUp.push(
        `  await db.schema.createType(${quote}${
          enums[i].name
        }${quote}).asEnum([${quote}${
          enums[i].values.join(`${quote},${quote}`)
        }${quote}]).execute();`,
      );
      migratesDown.push(
        `  await db.schema.dropType(${quote}${
          enums[i].name
        }${quote}).ifExists().execute();`,
      );
    }
  }

  // create table
  if (tables) {
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const columns: string[] = [];
      const pk: string[] = [];

      // prepare `addColumn`
      for (let j = 0; j < table.columns.length; j++) {
        const column = table.columns[j];
        const type = (() => {
          if (column.type == "enum") return `sql\`${column.enum}\``;
          if ("length" in column) {
            return `${quote}${column.type}(${column.length})${quote}`;
          }
          return `${quote}${column.type}${quote}`;
        })();
        const attrs: { key: string; arg?: unknown }[] = [];
        if (column.primary) pk.push(column.name);
        if (column.notNull) attrs.push({ key: "notNull" });
        if (column.index == "unique") attrs.push({ key: "unique" });
        if ("default" in column) {
          attrs.push({
            key: "defaultTo",
            arg: `${quote}${column.default}${quote}`,
          });
        }
        const attr = attrs.length == 0
          ? ""
          : `, (col) => col.${
            attrs.map((item) => `${item.key}(${item.arg ? item.arg : ""})`)
              .join(".")
          }`;
        columns.push(
          `    .addColumn(${quote}${column.name}${quote}, ${type}${attr})`,
        );
      }

      // prepare foreign key(to set "onDelete" and more, we need to call createTable().addForeignKeyConstraint)
      const fks = (() => {
        if (!foreignKeys) return "";
        // .addForeignKeyConstraint('name', ["col1"], "table", ["targetColumns"], cb => cb.onDelete('cascade')).execute()
        const genCb = (
          { foreignKey: { onDelete, onUpdate } }: Parameters<
            typeof makeForeignKeyDefinition
          >[0],
        ) => {
          if (!onDelete && !onUpdate) return "";
          return `, (cb) => cb${
            onDelete ? `.onDelete(${quote}${onDelete}${quote})` : ""
          }${onUpdate ? `.onUpdate(${quote}${onUpdate}${quote})` : ""}`;
        };
        return foreignKeys.filter((fk) => fk.foreignKey.table == table.name)
          .map((fk) =>
            `    .addForeignKeyConstraint(${quote}${
              fk.name ?? `fk_${table.name}_${fk.foreignKey.columns.join("_")}`
            }${quote}, [${quote}${
              fk.foreignKey.columns.join('", "')
            }${quote}], ${quote}${fk.reference.table}${quote}, [${quote}${
              fk.reference.columns.join('", "')
            }${quote}]${genCb(fk)})\n`
          ).join("");
      })();

      // create table
      migratesUp.push(
        `  await db.schema.createTable(${quote}${table.name}${quote})\n${
          columns.join("\n")
        }\n${fks}    .execute();`,
      );
      // add primary key
      if (pk.length > 0) {
        migratesUp.push(
          `  await db.schema.alterTable(${quote}${table.name}${quote}).addPrimaryKeyConstraint(${quote}${table.name}_pk${quote}, [${quote}${
            pk.join(`${quote},${quote}`)
          }${quote}]).execute();`,
        );
      }

      // drop table
      migratesDown.push(
        `  await db.schema.dropTable(${quote}${table.name}${quote}).execute();`,
      );

      // create index
      if (table.indexes && table.indexes.length > 0) {
        for (let j = 0; j < table.indexes.length; j++) {
          const index = table.indexes[j];
          const indexName = index.name ??
            `${table.name}_${index.type == "unique" ? "unique_" : ""}index_${
              index.columns.join("_")
            }`;
          migratesUp.push(
            `  await db.schema.createIndex(${quote}${indexName}${quote}).on(${quote}${table.name}${quote}).columns(["${
              index.columns.join('", "')
            }"])${index.type == "unique" ? ".unique()" : ""}.execute();`,
          );
        }
      }
    }
  }

  return [
    `import { Kysely, sql } from ${quote}kysely${quote};`,
    "",
    `export async function up(db: Kysely<any>): Promise<void> {`,
    migratesUp.join("\n"),
    "}",
    "",
    `export async function down(db: Kysely<any>): Promise<void> {`,
    migratesDown.reverse().join("\n"),
    "}",
    "",
  ].join("\n");
}
