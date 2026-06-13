export * from "./types";
export { ProviderRegistry, getRegistry, resetRegistry } from "./registry";
export { OpenAiCompatProvider } from "./openai-compat";
export { AnthropicProvider } from "./anthropic";
export { GeminiProvider } from "./gemini";
export { OllamaProvider } from "./ollama";
export { OpenRouterProvider } from "./openrouter";
export { HuggingFaceProvider } from "./huggingface";
export { ModelRouter, getRouter } from "./router";
export { FallbackHandler, RateLimiter, getFallbackHandler, getRateLimiter } from "./fallback";
export type { RoutingDecision, RoutingConfig } from "./router";
export type { FallbackConfig } from "./fallback";

import { getRegistry, ProviderRegistry } from "./registry";
import { OpenAiCompatProvider } from "./openai-compat";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { OllamaProvider } from "./ollama";
import { OpenRouterProvider } from "./openrouter";
import { HuggingFaceProvider } from "./huggingface";
import type { ProviderConfig } from "./types";
import { getLogger } from "../shared/logger";

/** Register all default providers from configuration */
export function registerDefaultProviders(
  providerConfigs: Record<string, {
    enabled?: boolean;
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    priority?: number;
  }>,
): void {
  const registry = getRegistry();
  const log = getLogger();

  const configMap: Record<string, (config: ProviderConfig) => boolean> = {
    deepseek: (cfg) => { registry.register("deepseek", new OpenAiCompatProvider("deepseek", cfg)); return true; },
    qwen: (cfg) => { registry.register("qwen", new OpenAiCompatProvider("qwen", cfg)); return true; },
    groq: (cfg) => { registry.register("groq", new OpenAiCompatProvider("groq", cfg)); return true; },
    mistral: (cfg) => { registry.register("mistral", new OpenAiCompatProvider("mistral", cfg)); return true; },
    "openai": (cfg) => { registry.register("openai", new OpenAiCompatProvider("openai", cfg)); return true; },
    anthropic: (cfg) => { registry.register("anthropic", new AnthropicProvider(cfg)); return true; },
    gemini: (cfg) => { registry.register("gemini", new GeminiProvider(cfg)); return true; },
    ollama: (cfg) => { registry.register("ollama", new OllamaProvider(cfg)); return true; },
    openrouter: (cfg) => { registry.register("openrouter", new OpenRouterProvider(cfg)); return true; },
    huggingface: (cfg) => { registry.register("huggingface", new HuggingFaceProvider(cfg)); return true; },
  };

  for (const [name, cfg] of Object.entries(providerConfigs)) {
    if (cfg.enabled === false) {
      log.debug(`Skipping disabled provider: ${name}`);
      continue;
    }
    const register = configMap[name];
    if (register) {
      register(cfg as ProviderConfig);
      log.debug(`Provider registered from config: ${name}`);
    }
  }

  log.info(`Registered ${registry.count} providers: ${registry.names.join(", ")}`);
}

/** Initialize all registered providers */
export async function initializeProviders(): Promise<void> {
  const registry = getRegistry();
  await registry.initializeAll();
}
