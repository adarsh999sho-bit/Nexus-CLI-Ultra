import type {
  LlmProvider,
  LlmMessage,
  LlmResponse,
  CompleteOptions,
  StreamOptions,
  StreamChunk,
  ModelInfo,
  ProviderHealth,
  ProviderConfig as ProviderCfg,
} from "./types";

export class OpenRouterProvider implements LlmProvider {
  readonly name = "openrouter";
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private timeoutMs: number;
  private available = false;

  constructor(config: ProviderCfg) {
    this.apiKey = config.apiKey || process.env.OPENROUTER_API_KEY || "";
    this.baseUrl = config.baseUrl || "https://openrouter.ai/api/v1";
    this.defaultModel = config.defaultModel || "auto";
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) this.apiKey = process.env.OPENROUTER_API_KEY || "";
    this.available = !!this.apiKey;
  }

  isAvailable(): boolean {
    return this.available;
  }

  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      "HTTP-Referer": "https://nexus-cli-ultra.dev",
      "X-Title": "Nexus CLI Ultra",
    };
  }

  async complete(
    messages: LlmMessage[],
    model?: string,
    options?: CompleteOptions,
  ): Promise<LlmResponse> {
    const body = {
      model: model || this.defaultModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
    };

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: options?.signal,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }
      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        model: string;
      };
      return {
        content: data.choices?.[0]?.message?.content || "",
        usage: data.usage ? { input: data.usage.prompt_tokens, output: data.usage.completion_tokens, total: data.usage.total_tokens } : undefined,
        model: data.model,
      };
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  async *stream(
    messages: LlmMessage[],
    model?: string,
    options?: StreamOptions,
  ): AsyncGenerator<StreamChunk> {
    const body = {
      model: model || this.defaultModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: true,
    };

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: options?.signal,
      });
      if (!response.body) { yield { type: "error", error: "No response body" }; return; }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") { yield { type: "done" }; return; }
          try {
            const chunk = JSON.parse(data) as { choices: Array<{ delta: { content?: string } }> };
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) { yield { type: "text", content }; options?.onToken?.(content); }
          } catch { /* skip */ }
        }
      }
      yield { type: "done" };
    } catch (err) {
      yield { type: "error", error: String(err) };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!response.ok) return [];
      const data = (await response.json()) as { data: Array<{ id: string; name: string; pricing?: { prompt: string; completion: string } }> };
      return data.data.map((m) => ({
        id: m.id,
        name: m.name || m.id,
        provider: this.name,
        capabilities: { streaming: true, functionCalling: true, vision: m.id.includes("vision"), maxContextWindow: 128_000, maxOutputTokens: 4096, supportsSystemPrompt: true },
        isFree: !m.pricing || (Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0),
      }));
    } catch { return []; }
  }

  async health(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      this.available = response.ok;
      return { available: response.ok, latencyMs: Date.now() - start, lastChecked: new Date() };
    } catch (err) {
      this.available = false;
      return { available: false, lastError: String(err), lastChecked: new Date() };
    }
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
