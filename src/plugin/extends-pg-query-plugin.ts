import {
  AliasNode,
  AnyColumnWithTable,
  InsertQueryNode,
  KyselyPlugin,
  OperationNodeTransformer,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  QueryResult,
  RawNode,
  RootOperationNode,
  TableNode,
  UnknownRow,
  UpdateQueryNode,
  ValueNode,
  ValuesItemNode,
  ValuesNode,
} from "kysely";

// deno-lint-ignore ban-types
type StringWithSuggestion<T extends string> = T | (string & {});

/**
 * example
 *
 * ```ts
 * interface Person {
 *   id: number;
 *   name: string;
 *   family: { name: string }[];
 *   updated_at: ColumnType<Date, never, never>;
 * };
 * interface Database {
 *   person: Person;
 * }
 * const db = new Kysely<Database>({
 *   dialect,
 *   plugins: [
 *     new ExtendsPgQueryPlugin<Database>({
 *       jsonColumns: ["person.family"],
 *       autoUpdates: [{ "person.updated_at": "DEFAULT" }],
 *     }),
 *   ],
 * });
 * ```
 */
export default class ExtendsPgQueryPlugin<DB> implements KyselyPlugin {
  private readonly transformer: ExtendsPgQueryTransformer;

  constructor(
    options?: {
      jsonColumns?: AnyColumnWithTable<DB, keyof DB>[];
      autoUpdates?: {
        [key in AnyColumnWithTable<DB, keyof DB>]?: StringWithSuggestion<
          "DEFAULT"
        >;
      };
    },
  ) {
    const jsonColumns = new Map<string, Set<string>>();
    if (options?.jsonColumns) {
      for (const item of options.jsonColumns) {
        const arr = item.split(".");
        if (!jsonColumns.has(arr[0])) {
          jsonColumns.set(arr[0], new Set());
        }
        jsonColumns.get(arr[0])?.add(arr[1]);
      }
    }

    const autoUpdates = new Map<
      string,
      Map<string, StringWithSuggestion<"DEFAULT">>
    >();
    if (options?.autoUpdates) {
      for (
        const key of Object.keys(options.autoUpdates) as AnyColumnWithTable<
          DB,
          keyof DB
        >[]
      ) {
        const item = options.autoUpdates[key];
        if (!item) continue;
        const arr = key.split(".");
        if (!autoUpdates.has(arr[0])) {
          autoUpdates.set(arr[0], new Map());
        }
        autoUpdates.get(arr[0])?.set(arr[1], item);
      }
    }

    this.transformer = new ExtendsPgQueryTransformer({
      jsonColumns,
      autoUpdates,
    });
  }

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    return this.transformer.transformNode(args.node);
  }

  transformResult(
    args: PluginTransformResultArgs,
  ): Promise<QueryResult<UnknownRow>> {
    return Promise.resolve(args.result);
  }
}

// transformer
class ExtendsPgQueryTransformer extends OperationNodeTransformer {
  readonly #jsonColumns: Map<string, Set<string>>; // for define `JSON.stringify` columns
  readonly #autoUpdates: Map<
    string,
    Map<string, StringWithSuggestion<"DEFAULT">>
  >; // for define auto update columns

  constructor(
    options: {
      jsonColumns: Map<string, Set<string>>;
      autoUpdates: Map<string, Map<string, StringWithSuggestion<"DEFAULT">>>;
    },
  ) {
    super();
    this.#jsonColumns = options.jsonColumns;
    this.#autoUpdates = options.autoUpdates;
  }

  protected override transformInsertQuery(
    node: InsertQueryNode,
  ): InsertQueryNode {
    // if no columns detected, call super and return
    if (
      !node.columns || node.columns.length == 0 || !node.values
    ) {
      return super.transformInsertQuery(node);
    }
    // if the table is not target, call super and return
    const table = node.into.table.identifier.name;
    if (!table || !this.#jsonColumns.has(table)) {
      return super.transformInsertQuery(node);
    }

    const jsonTargets = this.#jsonColumns.get(table);
    const insertTargets = node.columns.map((item) => item.column.name);
    const targetIndexes: number[] = [];
    for (let i = 0; i < insertTargets.length; i++) {
      if (jsonTargets?.has(insertTargets[i])) targetIndexes.push(i);
    }

    // if target columns don't include json column, call super and return
    if (targetIndexes.length == 0) {
      return super.transformInsertQuery(node);
    }

    const { values: rawValues, onConflict: rawOnConflict, ...rest } = node;

    // unknown format, so call super and return
    if (rawValues.kind != "ValuesNode") {
      return super.transformInsertQuery(node);
    }

    const valuesList: ValuesItemNode[] = [];
    for (const valuesItem of (rawValues as ValuesNode).values) {
      // replace JSON column with `JSON.stringify`
      if (valuesItem.kind == "PrimitiveValueListNode") {
        valuesList.push({
          kind: "PrimitiveValueListNode",
          values: valuesItem.values.map((item, index) =>
            targetIndexes.includes(index) && item !== null
              ? JSON.stringify(item)
              : item
          ),
        });
      }

      if (valuesItem.kind == "ValueListNode") {
        valuesList.push({
          kind: "ValueListNode",
          values: valuesItem.values.map((item, index) => {
            if (
              item.kind != "ValueNode" || !targetIndexes.includes(index) ||
              (item as ValueNode).value === null
            ) {
              return item;
            }
            return {
              kind: "ValueNode",
              value: JSON.stringify((item as ValueNode).value),
            };
          }),
        });
      }
    }

    // auto update columns
    const autoUpdates = this.#autoUpdates.get(table);
    const autoUpdateTargets = new Set(autoUpdates?.keys());

    // onConflict: replace JSON column with `JSON.stringify`
    const onConflict = (() => {
      // if (!rawOnConflict?.updates) return rawOnConflict;
      if (!rawOnConflict) return rawOnConflict;
      const updates = [];
      if (rawOnConflict.updates) {
        for (const item of rawOnConflict.updates) {
          autoUpdateTargets.delete(item.column.column.name);

          if (
            !jsonTargets?.has(item.column.column.name) ||
            item.value.kind != "ValueNode"
          ) {
            updates.push(item);
            continue;
          }
          const itemValue = item.value as ValueNode;
          if (itemValue.value === null) {
            updates.push(item);
            continue;
          }
          updates.push({
            ...item,
            value: { ...itemValue, value: JSON.stringify(itemValue.value) },
          });
        }
      }

      // auto update if not specified
      for (const column of autoUpdateTargets) {
        const value = autoUpdates?.get(column);
        if (value == undefined) continue;
        updates.push({
          kind: "ColumnUpdateNode" as const,
          column: {
            kind: "ColumnNode" as const,
            column: { kind: "IdentifierNode" as const, name: column },
          },
          value: {
            kind: "RawNode",
            sqlFragments: [value],
            parameters: [],
          } as RawNode,
        });
      }

      return { ...rawOnConflict, updates };
    })();

    const values: ValuesNode = { kind: "ValuesNode", values: valuesList };
    return super.transformInsertQuery({ ...rest, values, onConflict });
  }

  protected override transformUpdateQuery(
    node: UpdateQueryNode,
  ): UpdateQueryNode {
    // if no update columns, call super and return
    if (!node.updates || node.updates.length == 0) {
      return super.transformUpdateQuery(node);
    }

    // get target table
    const table = (() => {
      let tableNode = node.table;
      if (tableNode.kind == "AliasNode") {
        tableNode = (tableNode as AliasNode).node;
      }
      if (tableNode.kind == "TableNode") {
        return (tableNode as TableNode).table.identifier.name;
      }
    })();
    // if unknown format or not target table, call super and return
    if (
      !table || (!this.#jsonColumns.has(table) && !this.#autoUpdates.has(table))
    ) {
      return super.transformUpdateQuery(node);
    }

    // auto update columns
    const autoUpdates = this.#autoUpdates.get(table);
    const autoUpdateTargets = new Set(autoUpdates?.keys());

    // update `node.updates`: JSON.stringify
    const targets = this.#jsonColumns.get(table);
    const updates = node.updates.map((update) => {
      const columnName = update.column.column.name;

      // if specified, remove from auto update
      autoUpdateTargets.delete(columnName);

      if (
        !targets || !targets.has(columnName) ||
        update.value.kind != "ValueNode" ||
        (update.value as ValueNode).value === null
      ) {
        return update;
      }
      return {
        ...update,
        value: {
          ...update.value,
          value: JSON.stringify((update.value as ValueNode).value),
        },
      };
    });

    // auto update if not specified
    for (const column of autoUpdateTargets) {
      const value = autoUpdates?.get(column);
      if (value == undefined) continue;
      updates.push({
        kind: "ColumnUpdateNode",
        column: {
          kind: "ColumnNode",
          column: { kind: "IdentifierNode", name: column },
        },
        value: {
          kind: "RawNode",
          sqlFragments: [value],
          parameters: [],
        } as RawNode,
      });
    }

    // call super and return
    return super.transformUpdateQuery({ ...node, updates });
  }
}
