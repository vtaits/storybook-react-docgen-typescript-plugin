import type { DocgenPluginType } from "./plugin";

class EmptyPlugin {
  apply() {}
}

let plugin: DocgenPluginType;

// It should be possible to use the plugin without TypeScript.
// In that case using it is a no-op.
try {
  require.resolve("typescript");
  plugin = require("./plugin").default;
} catch (error) {
  console.log(error);
  plugin = EmptyPlugin as unknown as DocgenPluginType;
}

export { PluginOptions } from "./plugin";
export { plugin as ReactDocgenTypeScriptPlugin };
export default plugin;
