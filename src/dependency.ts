/* eslint-disable max-classes-per-file */
import * as webpack from "webpack";

// eslint-disable-next-line
// @ts-ignore: What's the right way to refer to this one?
import makeSerializable from "webpack/lib/util/makeSerializable.js";

// eslint-disable-next-line
// @ts-ignore: What's the right way to refer to this one?
import NullDependency from "webpack/lib/dependencies/NullDependency.js";

// This won't be needed when only webpack 5+ can be supported. Patching for now.
type Context = { write?: (a: string) => void; read?: () => string };

class DocGenDependency extends webpack.Dependency {
  public codeBlock: string;

  constructor(codeBlock: string) {
    super();

    this.codeBlock = codeBlock;
  }

  get type(): string {
    return "docgen";
  }

  getModuleEvaluationSideEffectsState(): boolean {
    return false;
  }

  updateHash: webpack.dependencies.NullDependency["updateHash"] = (hash) => {
    hash.update(this.codeBlock);
  };

  serialize(context: Context): void {
    const { write } = context;
    write?.(this.codeBlock);
  }

  deserialize(context: Context): void {
    const { read } = context;
    this.codeBlock = read ? read() : "";
  }
}

makeSerializable(
  DocGenDependency,
  "react-docgen-typescript-plugin/dist/dependency",
);

type NullDependencyTemplateType = InstanceType<
  typeof webpack.dependencies.NullDependency.Template
>;
export class DocGenTemplate
  extends NullDependency.Template
  implements NullDependencyTemplateType
{
  apply: NullDependencyTemplateType["apply"] = (
    dependency: DocGenDependency,
    source,
  ) => {
    if (dependency.codeBlock) {
      // Insert to the end
      source.insert(Number.POSITIVE_INFINITY, dependency.codeBlock);
    }
  };
}

export { DocGenDependency };
