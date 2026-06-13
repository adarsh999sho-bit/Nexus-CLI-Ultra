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

export class OllamaProvider implements LlmProvider {
  readonly name = "ollama";
  private baseUrl: string;
  private defaultModel: string;
  private timeoutMs: number;
  private available = false;

  constructor(config: ProviderCfg) {
    this.baseUrl = config.baseUrl || process.env.OLLAMA_HOST || "http://localhost:11434";
    this.defaultModel = config.defaultModel || "codellama";
    this.timeoutMs = config.timeoutMs ?? 60_000;
  }

  async initialize(): Promise<void> {
    try {
      const health = await this.health();
      this.available = health.available;
    } catch {
      this.available = false;
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  async complete(
    messages: LlmMessage[],
    model?: string,
    options?: CompleteOptions,
  ): Promise<LlmResponse> {
    const body = {
      model: model || this.defaultModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens,
        top_p: options?.topP,
        stop: options?.stop,
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: options?.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { message: { content: string }; total_duration?: number };
      return {
        content: data.message?.content || "",
        usage: data.total_duration ? { input: 0, output: 0, total: Math.ceil(data.total_duration / 1000) } : undefined,
        model: model || this.defaultModel,
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
      stream: true,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens,
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: options?.signal,
      });
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
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            if (chunk.message?.content) {
              yield { type: "text", content: chunk.message.content };
              options?.onToken?.(chunk.message.content);
            }
            if (chunk.done) {
              yield { type: "done" };
              return;
            }
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
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];
      const data = (await response.json()) as { models: Array<{ name: string; modified_at: string }> };
      return data.models.map((m) => ({
        id: m.name,
        name: m.name,
        provider: this.name,
        capabilities: {
          streaming: true, functionCalling: false, vision: m.name.includes("vision"),
          maxContextWindow: 4096, maxOutputTokens: 4096, supportsSystemPrompt: true,
        },
        isFree: true,
      }));
    } catch {
      return [];
    }
  }

  async health(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
      const ok = response.ok;
      this.available = ok;
      return { available: ok, latencyMs: Date.now() - start, lastChecked: new Date() };
    } catch (err) {
      this.available = false;
      return { available: false, lastError: String(err), lastChecked: new Date() };
    }
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
