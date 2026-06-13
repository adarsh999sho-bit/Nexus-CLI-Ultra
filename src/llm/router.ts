import type { TaskType, ProviderType } from "../shared/types";
import type { LlmProvider } from "./types";
import { getRegistry } from "./registry";
import { getLogger } from "../shared/logger";

export interface RoutingDecision {
  provider: LlmProvider;
  providerName: string;
  model: string;
  isFree: boolean;
  reason: string;
}

export interface RoutingConfig {
  taskType: TaskType;
  preferredProviders: string[];
  fallbackProviders: string[];
  maxCostCents: number;
}

export class ModelRouter {
  private log = getLogger();

  /** Route a task to the best available provider */
  async route(
    taskType: TaskType,
    preferredProviders?: string[],
    fallbackProviders?: string[],
  ): Promise<RoutingDecision> {
    const registry = getRegistry();
    const available = await registry.getAvailable();

    if (available.size === 0) {
      throw new Error("No LLM providers available. Run `nexus doctor` to diagnose.");
    }

    // Try preferred providers first
    if (preferredProviders) {
      for (const name of preferredProviders) {
        const provider = available.get(name);
        if (provider) {
          const models = await provider.listModels();
          const freeModel = models.find((m) => m.isFree);
          this.log.debug(`Routing ${taskType} to preferred provider: ${name}`);
          return {
            provider,
            providerName: name,
            model: freeModel?.id || provider["defaultModel" as keyof typeof provider] as string || "",
            isFree: !!freeModel,
            reason: `Preferred provider: ${name}`,
          };
        }
      }
    }

    // Try fallback providers
    if (fallbackProviders) {
      for (const name of fallbackProviders) {
        const provider = available.get(name);
        if (provider) {
          const models = await provider.listModels();
          const freeModel = models.find((m) => m.isFree);
          this.log.debug(`Routing ${taskType} to fallback provider: ${name}`);
          return {
            provider,
            providerName: name,
            model: freeModel?.id || "",
            isFree: !!freeModel,
            reason: `Fallback provider: ${name}`,
          };
        }
      }
    }

    // Fall back to any available provider
    const [firstAvailable] = Array.from(available.entries());
    if (firstAvailable) {
      const [name, provider] = firstAvailable;
      this.log.debug(`Routing ${taskType} to any available provider: ${name}`);
      return {
        provider,
        providerName: name,
        model: "",
        isFree: false,
        reason: `Last resort: ${name}`,
      };
    }

    throw new Error("No providers available for task routing");
  }

  /** Route with cost budget consideration */
  async routeWithBudget(
    taskType: TaskType,
    maxCostCents: number = 0,
  ): Promise<RoutingDecision> {
    const registry = getRegistry();
    const available = await registry.getAvailable();

    // Free budget: prefer free models
    if (maxCostCents === 0) {
      for (const [name, provider] of available) {
        const models = await provider.listModels();
        const freeModel = models.find((m) => m.isFree);
        if (freeModel) {
          return {
            provider,
            providerName: name,
            model: freeModel.id,
            isFree: true,
            reason: `Free model from ${name}`,
          };
        }
      }
    }

    // With budget: find providers within cost
    return this.route(taskType);
  }

  /** Get a quick recommendation for a task type based on config */
  async recommend(taskType: TaskType, configs: RoutingConfig[]): Promise<RoutingDecision> {
    const config = configs.find((c) => c.taskType === taskType);
    if (config) {
      return this.route(taskType, config.preferredProviders, config.fallbackProviders);
    }
    return this.route(taskType);
  }
}

let _router: ModelRouter | null = null;

export function getRouter(): ModelRouter {
  _router ||= new ModelRouter();
  return _router;
}
