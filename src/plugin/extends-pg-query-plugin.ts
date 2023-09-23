import {
  AliasNode,
  AnyColumnWithTable,
  InsertQueryNode,
  KyselyPlugin,
  OperationNodeTransformer,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  PrimitiveValueListNode,
  QueryResult,
  RootOperationNode,
  TableNode,
  UnknownRow,
  UpdateQueryNode,
  ValueListNode,
  ValueNode,
  ValuesNode,
} from "kysely";

/**
 * example
 *
 * ```ts
 * interface Person {
 *   id: number;
 *   name: string;
 *   family: { name: string }[];
 * };
 * interface Database {
 *   person: Person;
 * }
 * const db = new Kysely<Database>({
 *   dialect,
 *   plugins: [
 *     new ExtendsPgQueryPlugin<Database>({
 *       jsonColumns: ["person.family"],
 *     }),
 *   ],
 * });
 * ```
 */
export default class ExtendsPgQueryPlugin<DB> implements KyselyPlugin {
  private readonly transformer: ExtendsPgQueryTransformer;

  constructor(options?: { jsonColumns?: AnyColumnWithTable<DB, keyof DB>[] }) {
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

    this.transformer = new ExtendsPgQueryTransformer({ jsonColumns });
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

  constructor(options: { jsonColumns: Map<string, Set<string>> }) {
    super();
    this.#jsonColumns = options.jsonColumns;
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

    const { values: rawValues, ...rest } = node;

    // unknown format, so call super and return
    if (
      rawValues.kind != "ValuesNode" ||
      (rawValues as ValuesNode).values.length != 1
    ) {
      return super.transformInsertQuery(node);
    }
    const valuesList = (rawValues as ValuesNode).values[0];

    // replace JSON column with `JSON.stringify`
    const newValuesListItem = (() => {
      if (valuesList.kind == "PrimitiveValueListNode") {
        return {
          kind: "PrimitiveValueListNode",
          values: valuesList.values.map((item, index) =>
            targetIndexes.includes(index) ? JSON.stringify(item) : item
          ),
        } as PrimitiveValueListNode;
      }
      return {
        kind: "ValueListNode",
        values: valuesList.values.map((item, index) => {
          if (item.kind != "ValueNode" || !targetIndexes.includes(index)) {
            return item;
          }
          return {
            kind: "ValueNode",
            value: JSON.stringify((item as ValueNode).value),
          };
        }),
      } as ValueListNode;
    })();

    const values: ValuesNode = {
      kind: "ValuesNode",
      values: [newValuesListItem],
    };

    return super.transformInsertQuery({ ...rest, values });
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
    if (!table || !this.#jsonColumns.has(table)) {
      return super.transformUpdateQuery(node);
    }

    // update `node.updates`: JSON.stringify
    const targets = this.#jsonColumns.get(table);
    const updates = node.updates.map((update) => {
      if (
        !targets?.has(update.column.column.name) ||
        update.value.kind != "ValueNode" ||
        typeof (update.value as ValueNode).value != "object"
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

    // call super and return
    return super.transformUpdateQuery({ ...node, updates });
  }
}
