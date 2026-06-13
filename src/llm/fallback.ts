import type { LlmProvider, LlmMessage, LlmResponse, CompleteOptions, StreamOptions, StreamChunk } from "./types";
import { getRegistry } from "./registry";
import { getLogger } from "../shared/logger";

export interface FallbackConfig {
  /** Max retries per provider */
  maxRetries: number;
  /** Providers to try in order */
  providerChain: string[];
  /** Whether to try other providers on failure */
  enableCrossProviderFallback: boolean;
  /** Delay between retries (ms) */
  retryDelayMs: number;
}

const DEFAULT_CONFIG: FallbackConfig = {
  maxRetries: 3,
  providerChain: ["deepseek", "gemini", "qwen", "groq", "mistral", "openrouter"],
  enableCrossProviderFallback: true,
  retryDelayMs: 1000,
};

export class FallbackHandler {
  private config: FallbackConfig;
  private log = getLogger();

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Execute a completion with retry and cross-provider fallback */
  async withFallback(
    messages: LlmMessage[],
    model?: string,
    options?: CompleteOptions,
  ): Promise<LlmResponse> {
    const registry = getRegistry();
    let lastError: Error | undefined;

    // Try providers in chain order
    for (const providerName of this.config.providerChain) {
      const provider = registry.get(providerName);
      if (!provider || !provider.isAvailable()) continue;

      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        try {
          const response = await provider.complete(messages, model, {
            ...options,
            signal: options?.signal,
          });
          this.log.debug(`Fallback success: ${providerName} (attempt ${attempt + 1})`);
          return response;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          this.log.warn(`Fallback attempt failed: ${providerName} (${attempt + 1}/${this.config.maxRetries + 1})`, { error: lastError.message });

          if (
            attempt < this.config.maxRetries &&
            this.isRetryable(lastError)
          ) {
            await this.delay(this.config.retryDelayMs * Math.pow(2, attempt));
            continue;
          }
          break; // Move to next provider
        }
      }
    }

    // If no provider chain works, try any available provider
    if (this.config.enableCrossProviderFallback) {
      const available = await registry.getAvailable();
      for (const [name, provider] of available) {
        if (this.config.providerChain.includes(name)) continue; // Already tried
        try {
          const response = await provider.complete(messages, model, options);
          this.log.debug(`Cross-provider fallback success: ${name}`);
          return response;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
        }
      }
    }

    throw lastError || new Error("All providers failed");
  }

  /** Execute streaming with fallback */
  async *streamWithFallback(
    messages: LlmMessage[],
    model?: string,
    options?: StreamOptions,
  ): AsyncGenerator<StreamChunk> {
    const registry = getRegistry();
    let lastError: Error | undefined;

    for (const providerName of this.config.providerChain) {
      const provider = registry.get(providerName);
      if (!provider || !provider.isAvailable()) continue;

      try {
        for await (const chunk of provider.stream(messages, model, options)) {
          yield chunk;
          if (chunk.type === "done") return;
        }
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.log.warn(`Stream fallback from ${providerName}`, { error: lastError.message });
        yield { type: "text", content: `\n\n[Falling back from ${providerName}...]\n` };
      }
    }

    if (lastError) {
      yield { type: "error", error: `All streaming providers failed: ${lastError.message}` };
    }
  }

  private isRetryable(err: Error): boolean {
    const msg = err.message;
    return (
      msg.includes("429") ||
      msg.includes("500") ||
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("rate limit") ||
      msg.includes("timeout") ||
      msg.includes("abort") ||
      msg.includes("EOF")
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/** Rate limiter */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRpm: number;

  constructor(maxRpm: number = 30) {
    this.maxRpm = maxRpm;
  }

  /** Check if a request is allowed for the given provider */
  async acquire(provider: string): Promise<boolean> {
    const now = Date.now();
    const windowMs = 60_000; // 1 minute

    let timestamps = this.requests.get(provider) || [];
    timestamps = timestamps.filter((t) => now - t < windowMs);

    if (timestamps.length >= this.maxRpm) {
      const waitMs = windowMs - (now - timestamps[0]);
      if (waitMs > 0) {
        await this.delay(waitMs);
      }
      timestamps = timestamps.filter((t) => now - t < windowMs);
    }

    timestamps.push(now);
    this.requests.set(provider, timestamps);
    return true;
  }

  /** Get remaining requests for this minute */
  remaining(provider: string): number {
    const now = Date.now();
    const timestamps = (this.requests.get(provider) || []).filter((t) => now - t < 60_000);
    return Math.max(0, this.maxRpm - timestamps.length);
  }

  /** Reset rate limits for all providers */
  reset(): void {
    this.requests.clear();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

let _fallbackHandler: FallbackHandler | null = null;
let _rateLimiter: RateLimiter | null = null;

export function getFallbackHandler(config?: Partial<FallbackConfig>): FallbackHandler {
  _fallbackHandler ||= new FallbackHandler(config);
  return _fallbackHandler;
}

export function getRateLimiter(maxRpm?: number): RateLimiter {
  _rateLimiter ||= new RateLimiter(maxRpm);
  return _rateLimiter;
}
