import path from "node:path";
import createDebug from "debug";
import picomatch from "picomatch";
import * as docGen from "react-docgen-typescript";
import ts from "typescript";
import type * as webpack from "webpack";
import { DocGenDependency, DocGenTemplate } from "./dependency";
import {
  type GeneratorOptions,
  generateDocgenCodeBlock,
} from "./generateDocgenCodeBlock";
import type { LoaderOptions } from "./types";

const debugExclude = createDebug("docgen:exclude");

interface TypescriptOptions {
  /**
   * Specify the location of the tsconfig.json to use. Can not be used with
   * compilerOptions.
   **/
  tsconfigPath?: string;
  /** Specify TypeScript compiler options. Can not be used with tsconfigPath. */
  compilerOptions?: ts.CompilerOptions;
}

export type PluginOptions = docGen.ParserOptions &
  LoaderOptions &
  TypescriptOptions & {
    /** Glob patterns to ignore */
    exclude?: string[];
    /** Glob patterns to include. defaults to ts|tsx */
    include?: string[];
  };

/** Get the contents of the tsconfig in the system */
function getTSConfigFile(tsconfigPath: string): ts.ParsedCommandLine {
  try {
    const basePath = path.dirname(tsconfigPath);
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

    return ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      basePath,
      {},
      tsconfigPath,
    );
  } catch (error) {
    return {} as ts.ParsedCommandLine;
  }
}

/** Create a glob matching function. */
const matchGlob = (globs?: string[]) => {
  const matchers = (globs || []).map((g) => picomatch(g, { dot: true }));

  return (filename: string) =>
    Boolean(filename && matchers.find((match) => match(filename)));
};

/** Inject typescript docgen information into modules at the end of a build */
export default class DocgenPlugin implements webpack.WebpackPluginInstance {
  public static defaultOptions = {
    setDisplayName: true,
    typePropName: "type",
    docgenCollectionName: "STORYBOOK_REACT_CLASSES",
  };

  private name = "React Docgen Typescript Plugin";
  private options: PluginOptions;

  constructor(options: PluginOptions = {}) {
    this.options = options;
  }

  apply(compiler: webpack.Compiler): void {
    // Property compiler.version is set only starting from webpack 5
    const webpackVersion = compiler.webpack?.version || "";
    const isWebpack5 = Number.parseInt(webpackVersion.split(".")[0], 10) >= 5;

    if (isWebpack5) {
      this.applyWebpack5(compiler);
    } else {
      throw new Error("Webpack earlier than 5.x is not supported");
    }
  }

  applyWebpack5(compiler: webpack.Compiler): void {
    const pluginName = "DocGenPlugin";
    const { docgenOptions, compilerOptions, generateOptions } =
      this.getOptions();
    const docGenParser = docGen.withCompilerOptions(
      compilerOptions,
      docgenOptions,
    );
    const { exclude = [], include = ["**/**.tsx"] } = this.options;
    const isExcluded = matchGlob(exclude);
    const isIncluded = matchGlob(include);

    compiler.hooks.compilation.tap(
      pluginName,
      (compilation: webpack.Compilation) => {
        compilation.dependencyTemplates.set(
          DocGenDependency,
          new DocGenTemplate(),
        );

        compilation.hooks.seal.tap(pluginName, () => {
          const modulesToProcess: [string, webpack.Module][] = [];

          // 1. Aggregate modules to process
          for (const module of compilation.modules) {
            if (!module.nameForCondition) {
              continue;
            }

            const nameForCondition = module.nameForCondition() || "";

            // Ignore already built modules for webpack 5
            if (!compilation.builtModules.has(module)) {
              debugExclude(`Ignoring un-built module: ${nameForCondition}`);
              continue;
            }

            if (isExcluded(nameForCondition)) {
              debugExclude(
                `Module not matched in "exclude": ${nameForCondition}`,
              );
              continue;
            }

            if (!isIncluded(nameForCondition)) {
              debugExclude(
                `Module not matched in "include": ${nameForCondition}`,
              );
              continue;
            }

            modulesToProcess.push([nameForCondition, module]);
          }

          // 2. Create a ts program with the modules
          const tsProgram = ts.createProgram(
            modulesToProcess.map(([name]) => name),
            compilerOptions,
          );

          // 3. Process and parse each module and add the type information
          // as a dependency
          for (const [name, module] of modulesToProcess) {
            module.addDependency(
              new DocGenDependency(
                generateDocgenCodeBlock({
                  filename: name,
                  source: name,
                  componentDocs: docGenParser.parseWithProgramProvider(
                    name,
                    () => tsProgram,
                  ),
                  ...generateOptions,
                }).substring(name.length),
              ),
            );
          }
        });
      },
    );
  }

  getOptions(): {
    docgenOptions: docGen.ParserOptions;
    generateOptions: {
      docgenCollectionName: GeneratorOptions["docgenCollectionName"];
      setDisplayName: GeneratorOptions["setDisplayName"];
      typePropName: GeneratorOptions["typePropName"];
    };
    compilerOptions: ts.CompilerOptions;
  } {
    const {
      tsconfigPath = "./tsconfig.json",
      compilerOptions: userCompilerOptions,
      docgenCollectionName,
      setDisplayName,
      typePropName,
      ...docgenOptions
    } = this.options;
    const { defaultOptions } = DocgenPlugin;

    let compilerOptions = {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.Latest,
    };

    if (userCompilerOptions) {
      compilerOptions = {
        ...compilerOptions,
        ...userCompilerOptions,
      };
    } else {
      const { options: tsOptions } = getTSConfigFile(tsconfigPath);
      compilerOptions = { ...compilerOptions, ...tsOptions };
    }

    return {
      docgenOptions,
      generateOptions: {
        docgenCollectionName:
          docgenCollectionName === undefined
            ? defaultOptions.docgenCollectionName
            : docgenCollectionName,
        setDisplayName: setDisplayName ?? defaultOptions.setDisplayName,
        typePropName: typePropName ?? defaultOptions.typePropName,
      },
      compilerOptions,
    };
  }
}

export type DocgenPluginType = typeof DocgenPlugin;
