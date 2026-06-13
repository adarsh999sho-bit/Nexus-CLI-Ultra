import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PluginManifest, PluginInstance, PluginContext, PluginHook } from "./types";
import { getLogger } from "../shared/logger";

export class PluginLoader {
  private plugins: Map<string, PluginInstance> = new Map();
  private log = getLogger();

  /** Load a plugin from a local path */
  async loadFromPath(pluginPath: string): Promise<PluginInstance | null> {
    try {
      const manifestPath = join(pluginPath, "plugin.json");
      if (!existsSync(manifestPath)) {
        this.log.warn(`No plugin.json found at ${pluginPath}`);
        return null;
      }

      const manifest: PluginManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      return this.loadPlugin(manifest, pluginPath);
    } catch (err) {
      this.log.error(`Failed to load plugin from ${pluginPath}`, { error: String(err) });
      return null;
    }
  }

  /** Load a plugin from an npm package */
  async loadFromPackage(packageName: string): Promise<PluginInstance | null> {
    try {
      const modulePath = require.resolve(packageName, { paths: [process.cwd()] });
      const pluginDir = join(modulePath, "..");
      return this.loadFromPath(pluginDir);
    } catch {
      this.log.warn(`Plugin package not found: ${packageName}`);
      return null;
    }
  }

  /** Load a plugin from a manifest + path */
  private async loadPlugin(manifest: PluginManifest, basePath: string): Promise<PluginInstance> {
    const hooks = new Map<PluginHook, (ctx: PluginContext, ...args: unknown[]) => Promise<unknown>>();
    const tools = new Map<string, (input: unknown) => Promise<unknown>>();

    try {
      const mainPath = join(basePath, manifest.main);
      const pluginModule = await import(mainPath);

      // Register hooks
      for (const hookName of manifest.hooks) {
        const hookFn = pluginModule[`on${hookName.charAt(0).toUpperCase()}${hookName.slice(1)}`]
          || pluginModule[hookName];
        if (typeof hookFn === "function") {
          hooks.set(hookName, hookFn);
        }
      }

      // Register tools
      for (const toolName of manifest.tools) {
        const toolFn = pluginModule[toolName];
        if (typeof toolFn === "function") {
          tools.set(toolName, toolFn);
        }
      }
    } catch (err) {
      this.log.warn(`Failed to load plugin module: ${manifest.name}`, { error: String(err) });
    }

    const instance: PluginInstance = { manifest, hooks, tools };
    this.plugins.set(manifest.name, instance);
    this.log.info(`Plugin loaded: ${manifest.name} v${manifest.version}`);
    return instance;
  }

  /** Get a loaded plugin by name */
  get(name: string): PluginInstance | undefined {
    return this.plugins.get(name);
  }

  /** Get all loaded plugins */
  getAll(): Map<string, PluginInstance> {
    return new Map(this.plugins);
  }

  /** Unload a plugin */
  unload(name: string): boolean {
    return this.plugins.delete(name);
  }

  /** Execute a hook on all plugins that support it */
  async executeHook(hook: PluginHook, context: PluginContext, ...args: unknown[]): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      const hookFn = plugin.hooks.get(hook);
      if (hookFn) {
        try {
          await hookFn(context, ...args);
        } catch (err) {
          this.log.warn(`Plugin hook failed: ${name}.${hook}`, { error: String(err) });
        }
      }
    }
  }

  /** Get count of loaded plugins */
  get count(): number {
    return this.plugins.size;
  }
}
