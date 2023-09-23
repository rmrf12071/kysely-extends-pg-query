import {
  AliasNode,
  AnyColumnWithTable,
  KyselyPlugin,
  OperationNodeTransformer,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  QueryResult,
  RootOperationNode,
  TableNode,
  UnknownRow,
  UpdateQueryNode,
  ValueNode,
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
