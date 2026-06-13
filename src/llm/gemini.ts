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

interface GeminiContent {
  role: string;
  parts: Array<{ text: string }>;
}

interface GeminiCandidate {
  content: GeminiContent;
  finishReason: string;
}

interface GeminiUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

interface GeminiResponse {
  candidates: GeminiCandidate[];
  usageMetadata?: GeminiUsage;
}

interface GeminiStreamChunk {
  candidates?: Array<{
    content: { parts: Array<{ text?: string }>; role: string };
    finishReason?: string;
  }>;
}

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private maxRetries: number;
  private timeoutMs: number;
  private available = false;

  constructor(config: ProviderCfg) {
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    this.baseUrl = config.baseUrl || "https://generativelanguage.googleapis.com/v1beta";
    this.defaultModel = config.defaultModel || "gemini-2.0-flash";
    this.maxRetries = config.maxRetries ?? 3;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    }
    this.available = !!this.apiKey;
  }

  isAvailable(): boolean {
    return this.available;
  }

  private convertMessages(messages: LlmMessage[]): GeminiContent[] {
    const geminiMessages: GeminiContent[] = [];
    const system = messages.filter((m) => m.role === "system");
    const chat = messages.filter((m) => m.role !== "system");

    // Gemini doesn't have system role; prepend as user message
    if (system.length > 0) {
      geminiMessages.push({
        role: "user",
        parts: [{ text: `[System instructions]\n${system.map((m) => m.content).join("\n")}` }],
      });
      geminiMessages.push({
        role: "model",
        parts: [{ text: "Understood. I will follow these instructions." }],
      });
    }

    for (const msg of chat) {
      geminiMessages.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }
    return geminiMessages;
  }

  async complete(
    messages: LlmMessage[],
    model?: string,
    options?: CompleteOptions,
  ): Promise<LlmResponse> {
    const body = {
      contents: this.convertMessages(messages),
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 4096,
        topP: options?.topP,
      },
    };

    const url = `${this.baseUrl}/models/${model || this.defaultModel}:generateContent?key=${this.apiKey}`;

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, body, options?.signal);
        const data = (await response.json()) as GeminiResponse;
        return {
          content: data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "",
          usage: data.usageMetadata
            ? { input: data.usageMetadata.promptTokenCount, output: data.usageMetadata.candidatesTokenCount, total: data.usageMetadata.totalTokenCount }
            : undefined,
          model: model || this.defaultModel,
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
    const body = {
      contents: this.convertMessages(messages),
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 4096,
      },
    };

    const url = `${this.baseUrl}/models/${model || this.defaultModel}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    try {
      const response = await this.fetchWithTimeout(url, body, options?.signal);
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
          try {
            const chunk = JSON.parse(trimmed.slice(6)) as GeminiStreamChunk;
            const part = chunk.candidates?.[0]?.content?.parts?.[0];
            if (part?.text) {
              yield { type: "text", content: part.text };
              options?.onToken?.(part.text);
            }
            if (chunk.candidates?.[0]?.finishReason) {
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
    return [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: this.name, capabilities: { streaming: true, functionCalling: true, vision: true, maxContextWindow: 1_048_576, maxOutputTokens: 8192, supportsSystemPrompt: false }, isFree: true },
      { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", provider: this.name, capabilities: { streaming: true, functionCalling: false, vision: true, maxContextWindow: 1_048_576, maxOutputTokens: 8192, supportsSystemPrompt: false }, isFree: true },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: this.name, capabilities: { streaming: true, functionCalling: true, vision: true, maxContextWindow: 1_048_576, maxOutputTokens: 8192, supportsSystemPrompt: false }, isFree: false },
    ];
  }

  async health(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`);
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

  private async fetchWithTimeout(url: string, body?: unknown, signal?: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    return msg.includes("429") || msg.includes("500") || msg.includes("503") || msg.includes("rate limit") || msg.includes("timeout");
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
