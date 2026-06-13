import type { LlmProvider, ProviderHealth } from "./types";
import { getLogger } from "../shared/logger";

export class ProviderRegistry {
  private providers: Map<string, LlmProvider> = new Map();
  private healthCache: Map<string, ProviderHealth> = new Map();
  private log = getLogger();

  /** Register a provider */
  register(name: string, provider: LlmProvider): void {
    this.providers.set(name, provider);
    this.log.debug(`Provider registered: ${name}`);
  }

  /** Get a provider by name */
  get(name: string): LlmProvider | undefined {
    return this.providers.get(name);
  }

  /** Get all registered providers */
  getAll(): Map<string, LlmProvider> {
    return new Map(this.providers);
  }

  /** Get all available (healthy) providers */
  async getAvailable(): Promise<Map<string, LlmProvider>> {
    const available = new Map<string, LlmProvider>();
    for (const [name, provider] of this.providers) {
      if (provider.isAvailable()) {
        available.set(name, provider);
      }
    }
    return available;
  }

  /** Remove a provider */
  unregister(name: string): boolean {
    const removed = this.providers.delete(name);
    this.healthCache.delete(name);
    if (removed) this.log.debug(`Provider unregistered: ${name}`);
    return removed;
  }

  /** Check health of all providers */
  async checkAllHealth(): Promise<Map<string, ProviderHealth>> {
    const results = new Map<string, ProviderHealth>();
    const checks = Array.from(this.providers.entries()).map(
      async ([name, provider]) => {
        try {
          const health = await provider.health();
          results.set(name, health);
          this.healthCache.set(name, health);
        } catch (err) {
          const health: ProviderHealth = {
            available: false,
            lastError: String(err),
            lastChecked: new Date(),
          };
          results.set(name, health);
          this.healthCache.set(name, health);
        }
      },
    );
    await Promise.all(checks);
    return results;
  }

  /** Get cached health status */
  getCachedHealth(name: string): ProviderHealth | undefined {
    return this.healthCache.get(name);
  }

  /** Initialize all registered providers */
  async initializeAll(): Promise<void> {
    for (const [name, provider] of this.providers) {
      try {
        await provider.initialize();
        this.log.info(`Provider initialized: ${name}`);
      } catch (err) {
        this.log.warn(`Provider initialization failed: ${name}`, { error: String(err) });
      }
    }
  }

  /** Count registered providers */
  get count(): number {
    return this.providers.size;
  }

  /** Get provider names */
  get names(): string[] {
    return Array.from(this.providers.keys());
  }
}

/** Singleton registry */
let _registry: ProviderRegistry | null = null;

export function getRegistry(): ProviderRegistry {
  if (!_registry) {
    _registry = new ProviderRegistry();
  }
  return _registry;
}

export function resetRegistry(): void {
  _registry = null;
}
