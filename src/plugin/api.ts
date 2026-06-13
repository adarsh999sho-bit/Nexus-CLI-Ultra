import { PluginLoader } from "./loader";
import type { PluginContext } from "./types";
import { getLogger } from "../shared/logger";

export class PluginAPI {
  private loader: PluginLoader;
  private log = getLogger();
  private registeredTools: Map<string, (input: unknown) => Promise<unknown>> = new Map();
  private memory: Map<string, unknown> = new Map();

  constructor(loader: PluginLoader) {
    this.loader = loader;
  }

  /** Create a plugin context for hooks */
  createContext(): PluginContext {
    return {
      config: {},
      logger: {
        info: (msg: string) => this.log.info(`[plugin] ${msg}`),
        warn: (msg: string) => this.log.warn(`[plugin] ${msg}`),
        error: (msg: string) => this.log.error(`[plugin] ${msg}`),
      },
      registerTool: (name: string, handler: (input: unknown) => Promise<unknown>) => {
        this.registeredTools.set(name, handler);
        this.log.debug(`Plugin tool registered: ${name}`);
      },
      getMemory: (key: string) => this.memory.get(key),
      setMemory: (key: string, value: unknown) => { this.memory.set(key, value); },
    };
  }

  /** Execute startup hooks on all plugins */
  async runStartupHooks(): Promise<void> {
    const ctx = this.createContext();
    await this.loader.executeHook("onStartup", ctx);
  }

  /** Execute shutdown hooks on all plugins */
  async runShutdownHooks(): Promise<void> {
    const ctx = this.createContext();
    await this.loader.executeHook("onShutdown", ctx);
  }

  /** Execute before-task hooks */
  async beforeTask(task: unknown): Promise<void> {
    const ctx = this.createContext();
    await this.loader.executeHook("beforeTask", ctx, task);
  }

  /** Execute after-task hooks */
  async afterTask(task: unknown, result: unknown): Promise<void> {
    const ctx = this.createContext();
    await this.loader.executeHook("afterTask", ctx, task, result);
  }

  /** Get a registered tool by name */
  getTool(name: string): ((input: unknown) => Promise<unknown>) | undefined {
    return this.registeredTools.get(name);
  }

  /** Get all registered tool names */
  getToolNames(): string[] {
    return Array.from(this.registeredTools.keys());
  }

  /** Get plugin count */
  get pluginCount(): number {
    return this.loader.count;
  }
}
