import {
  KyselyPlugin,
  OperationNodeTransformer,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  QueryResult,
  RootOperationNode,
  SelectQueryNode,
  UnknownRow,
} from "kysely";

// ClearGroupbyPlugin: internal plugin
export default class ClearGroupbyPlugin implements KyselyPlugin {
  private readonly transformer: ClearGroupbyPluginTransformer;

  constructor() {
    this.transformer = new ClearGroupbyPluginTransformer();
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
class ClearGroupbyPluginTransformer extends OperationNodeTransformer {
  constructor() {
    super();
  }

  protected override transformSelectQuery(
    node: SelectQueryNode,
  ): SelectQueryNode {
    const { groupBy: _, ...n } = node;
    return super.transformSelectQuery(n);
  }
}
