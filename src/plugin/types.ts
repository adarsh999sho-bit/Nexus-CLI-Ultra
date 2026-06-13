/** A plugin manifest */
export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  main: string;
  hooks: PluginHook[];
  tools: string[];
  requires: string[];
}

/** Available plugin lifecycle hooks */
export type PluginHook =
  | "beforeTask"
  | "afterTask"
  | "beforeToolCall"
  | "afterToolCall"
  | "onError"
  | "onStartup"
  | "onShutdown";

/** Context passed to plugin hooks */
export interface PluginContext {
  config: Record<string, unknown>;
  logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
  registerTool: (name: string, handler: (input: unknown) => Promise<unknown>) => void;
  getMemory: (key: string) => unknown;
  setMemory: (key: string, value: unknown) => void;
}

/** A loaded plugin instance */
export interface PluginInstance {
  manifest: PluginManifest;
  hooks: Map<PluginHook, (ctx: PluginContext, ...args: unknown[]) => Promise<unknown>>;
  tools: Map<string, (input: unknown) => Promise<unknown>>;
}
