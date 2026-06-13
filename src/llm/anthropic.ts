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

interface AnthropicMessage {
  role: string;
  content: string;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  id: string;
  model: string;
  content: AnthropicContentBlock[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  stop_reason: string;
}

interface AnthropicStreamEvent {
  type: string;
  delta?: { text?: string };
  content_block?: AnthropicContentBlock;
  message?: { usage?: { input_tokens: number; output_tokens: number } };
}

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private maxRetries: number;
  private timeoutMs: number;
  private available = false;

  constructor(config: ProviderCfg) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || "";
    this.baseUrl = config.baseUrl || "https://api.anthropic.com/v1";
    this.defaultModel = config.defaultModel || "claude-sonnet-4-20250514";
    this.maxRetries = config.maxRetries ?? 3;
    this.timeoutMs = config.timeoutMs ?? 60_000;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      this.apiKey = process.env.ANTHROPIC_API_KEY || "";
    }
    this.available = !!this.apiKey;
    if (this.apiKey) {
      try { await this.health(); } catch { this.available = false; }
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01",
    };
  }

  private convertMessages(messages: LlmMessage[]): AnthropicMessage[] {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content);
    const chat = messages.filter((m) => m.role !== "system");
    return chat.map((m) => ({ role: m.role, content: m.content }));
  }

  private getSystemPrompt(messages: LlmMessage[]): string | undefined {
    const system = messages.filter((m) => m.role === "system");
    return system.length > 0 ? system.map((m) => m.content).join("\n") : undefined;
  }

  async complete(
    messages: LlmMessage[],
    model?: string,
    options?: CompleteOptions,
  ): Promise<LlmResponse> {
    const system = this.getSystemPrompt(messages);
    const body: Record<string, unknown> = {
      model: model || this.defaultModel,
      messages: this.convertMessages(messages),
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
    };
    if (system) body.system = system;

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout("/messages", body, options?.signal);
        const data = (await response.json()) as AnthropicResponse;
        return {
          content: data.content.map((c) => c.text || "").join(""),
          usage: data.usage
            ? { input: data.usage.input_tokens, output: data.usage.output_tokens, total: data.usage.input_tokens + data.usage.output_tokens }
            : undefined,
          model: data.model,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (this.isRetryable(lastError) && attempt < this.maxRetries) {
          await this.delay(1000 * Math.pow(2, attempt));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError!;
  }

  async *stream(
    messages: LlmMessage[],
    model?: string,
    options?: StreamOptions,
  ): AsyncGenerator<StreamChunk> {
    const system = this.getSystemPrompt(messages);
    const body: Record<string, unknown> = {
      model: model || this.defaultModel,
      messages: this.convertMessages(messages),
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      stream: true,
    };
    if (system) body.system = system;

    try {
      const response = await this.fetchWithTimeout("/messages", body, options?.signal);
      if (!response.body) {
        yield { type: "error", error: "No response body" };
        return;
      }

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
          try {
            const event = JSON.parse(data) as AnthropicStreamEvent;
            if (event.type === "content_block_delta" && event.delta?.text) {
              yield { type: "text", content: event.delta.text };
              options?.onToken?.(event.delta.text);
            }
            if (event.type === "message_stop") {
              yield { type: "done" };
              return;
            }
          } catch {
            // Skip malformed
          }
        }
      }
      yield { type: "done" };
    } catch (err) {
      yield { type: "error", error: String(err) };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: this.name, capabilities: { streaming: true, functionCalling: true, vision: true, maxContextWindow: 200_000, maxOutputTokens: 8192, supportsSystemPrompt: true }, isFree: false },
      { id: "claude-haiku-3.5-20241022", name: "Claude Haiku 3.5", provider: this.name, capabilities: { streaming: true, functionCalling: true, vision: true, maxContextWindow: 200_000, maxOutputTokens: 8192, supportsSystemPrompt: true }, isFree: false },
      { id: "claude-opus-4-20250514", name: "Claude Opus 4", provider: this.name, capabilities: { streaming: true, functionCalling: true, vision: true, maxContextWindow: 200_000, maxOutputTokens: 8192, supportsSystemPrompt: true }, isFree: false },
    ];
  }

  async health(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const response = await this.fetchWithTimeout("/messages", {
        model: this.defaultModel,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      });
      this.available = response.ok;
      return { available: response.ok, latencyMs: Date.now() - start, lastChecked: new Date() };
    } catch (err) {
      this.available = false;
      return { available: false, lastError: String(err), lastChecked: new Date() };
    }
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 3.5);
  }

  private async fetchWithTimeout(path: string, body?: unknown, signal?: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: signal || controller.signal,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private isRetryable(err: Error): boolean {
    const msg = err.message;
    return msg.includes("429") || msg.includes("500") || msg.includes("529") || msg.includes("rate limit") || msg.includes("timeout");
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
