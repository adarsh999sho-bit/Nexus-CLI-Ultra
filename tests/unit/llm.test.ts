import { describe, it, expect, mock } from "bun:test";

describe("Provider Types", () => {
  it("should define LlmProvider interface structure", async () => {
    const types = await import("../../src/llm/types");
    // Verify the types exist (structural check)
    expect(types).toBeDefined();
  });
});

describe("Provider Registry", () => {
  it("should register and retrieve providers", async () => {
    const { ProviderRegistry } = await import("../../src/llm/registry");
    const registry = new ProviderRegistry();

    // Mock provider
    const mockProvider = {
      name: "test-provider",
      initialize: mock(() => Promise.resolve()),
      isAvailable: mock(() => true),
      complete: mock(() => Promise.resolve({ content: "test", model: "test" })),
      stream: mock(function* () { /* stub */ }),
      listModels: mock(() => Promise.resolve([])),
      health: mock(() => Promise.resolve({ available: true, lastChecked: new Date() })),
      countTokens: mock((text: string) => text.length),
    };

    registry.register("test", mockProvider);
    expect(registry.get("test")).toBe(mockProvider);
    expect(registry.count).toBe(1);
    expect(registry.names).toContain("test");
  });

  it("should unregister providers", async () => {
    const { ProviderRegistry } = await import("../../src/llm/registry");
    const registry = new ProviderRegistry();

    registry.register("temp", { name: "temp", initialize: mock(), isAvailable: mock(() => false) } as any);
    expect(registry.count).toBe(1);

    registry.unregister("temp");
    expect(registry.count).toBe(0);
  });

  it("should get only available providers", async () => {
    const { ProviderRegistry } = await import("../../src/llm/registry");
    const registry = new ProviderRegistry();

    registry.register("available", {
      name: "avail",
      initialize: mock(),
      isAvailable: mock(() => true),
      listModels: mock(() => Promise.resolve([])),
      health: mock(() => Promise.resolve({ available: true, lastChecked: new Date() })),
    } as any);

    registry.register("unavailable", {
      name: "unavail",
      initialize: mock(),
      isAvailable: mock(() => false),
    } as any);

    const available = await registry.getAvailable();
    expect(available.has("available")).toBe(true);
    expect(available.has("unavailable")).toBe(false);
  });
});

describe("Model Router", () => {
  it("should throw when no providers available", async () => {
    const { ModelRouter } = await import("../../src/llm/router");
    const router = new ModelRouter();
    await expect(router.route("code-gen")).rejects.toThrow("No LLM providers available");
  });
});

describe("OpenAI Compat Provider", () => {
  it("should construct with config", async () => {
    const { OpenAiCompatProvider } = await import("../../src/llm/openai-compat");
    const provider = new OpenAiCompatProvider("test", {
      baseUrl: "https://api.test.com/v1",
      defaultModel: "test-model",
    });
    expect(provider.name).toBe("test");
    expect(provider.isAvailable()).toBe(false); // No API key
  });
});

describe("Anthropic Provider", () => {
  it("should construct with config", async () => {
    const { AnthropicProvider } = await import("../../src/llm/anthropic");
    const provider = new AnthropicProvider({
      defaultModel: "claude-sonnet-4-20250514",
    });
    expect(provider.name).toBe("anthropic");
    expect(provider.isAvailable()).toBe(false); // No API key
  });
});

describe("Gemini Provider", () => {
  it("should construct with config", async () => {
    const { GeminiProvider } = await import("../../src/llm/gemini");
    const provider = new GeminiProvider({});
    expect(provider.name).toBe("gemini");
    expect(provider.isAvailable()).toBe(false); // No API key
  });
});

describe("Ollama Provider", () => {
  it("should construct with config", async () => {
    const { OllamaProvider } = await import("../../src/llm/ollama");
    const provider = new OllamaProvider({});
    expect(provider.name).toBe("ollama");
    expect(provider.isAvailable()).toBe(false); // Not running
  });
});

describe("OpenRouter Provider", () => {
  it("should construct with config", async () => {
    const { OpenRouterProvider } = await import("../../src/llm/openrouter");
    const provider = new OpenRouterProvider({});
    expect(provider.name).toBe("openrouter");
    expect(provider.isAvailable()).toBe(false); // No API key
  });
});

describe("HuggingFace Provider", () => {
  it("should construct with config", async () => {
    const { HuggingFaceProvider } = await import("../../src/llm/huggingface");
    const provider = new HuggingFaceProvider({});
    expect(provider.name).toBe("huggingface");
    expect(provider.isAvailable()).toBe(false); // No API key
  });
});

describe("Fallback Handler", () => {
  it("should create with default config", async () => {
    const { FallbackHandler } = await import("../../src/llm/fallback");
    const handler = new FallbackHandler();
    expect(handler).toBeDefined();
  });

  it("should use custom config", async () => {
    const { FallbackHandler } = await import("../../src/llm/fallback");
    const handler = new FallbackHandler({ maxRetries: 5 });
    expect(handler).toBeDefined();
  });
});

describe("Rate Limiter", () => {
  it("should allow requests under limit", async () => {
    const { RateLimiter } = await import("../../src/llm/fallback");
    const limiter = new RateLimiter(60);
    const allowed = await limiter.acquire("test");
    expect(allowed).toBe(true);
    expect(limiter.remaining("test")).toBe(59);
  });

  it("should track remaining requests", async () => {
    const { RateLimiter } = await import("../../src/llm/fallback");
    const limiter = new RateLimiter(10);
    expect(limiter.remaining("test")).toBe(10);
    await limiter.acquire("test");
    expect(limiter.remaining("test")).toBe(9);
  });

  it("should reset all providers", async () => {
    const { RateLimiter } = await import("../../src/llm/fallback");
    const limiter = new RateLimiter(10);
    await limiter.acquire("test");
    limiter.reset();
    expect(limiter.remaining("test")).toBe(10);
  });
});

describe("LLM Index", () => {
  it("should export all modules", async () => {
    const llm = await import("../../src/llm/index");
    expect(llm.ProviderRegistry).toBeDefined();
    expect(llm.OpenAiCompatProvider).toBeDefined();
    expect(llm.AnthropicProvider).toBeDefined();
    expect(llm.GeminiProvider).toBeDefined();
    expect(llm.OllamaProvider).toBeDefined();
    expect(llm.OpenRouterProvider).toBeDefined();
    expect(llm.HuggingFaceProvider).toBeDefined();
    expect(llm.ModelRouter).toBeDefined();
    expect(llm.FallbackHandler).toBeDefined();
    expect(llm.RateLimiter).toBeDefined();
    expect(llm.registerDefaultProviders).toBeDefined();
    expect(llm.initializeProviders).toBeDefined();
  });
});
