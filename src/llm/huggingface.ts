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

export class HuggingFaceProvider implements LlmProvider {
  readonly name = "huggingface";
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private timeoutMs: number;
  private available = false;

  constructor(config: ProviderCfg) {
    this.apiKey = config.apiKey || process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY || "";
    this.baseUrl = config.baseUrl || "https://api-inference.huggingface.co";
    this.defaultModel = config.defaultModel || "microsoft/Phi-3-mini-4k-instruct";
    this.timeoutMs = config.timeoutMs ?? 120_000;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) this.apiKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY || "";
    this.available = !!this.apiKey;
  }

  isAvailable(): boolean {
    return this.available;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async complete(
    messages: LlmMessage[],
    model?: string,
    options?: CompleteOptions,
  ): Promise<LlmResponse> {
    const modelId = model || this.defaultModel;
    const prompt = messages.map((m) => `${m.role === "assistant" ? "Assistant" : m.role === "system" ? "System" : "User"}: ${m.content}`).join("\n") + "\nAssistant:";

    try {
      const response = await fetch(`${this.baseUrl}/models/${modelId}/v1/chat/completions`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: modelId,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: options?.maxTokens ?? 2048,
          temperature: options?.temperature ?? 0.7,
        }),
        signal: options?.signal,
      });

      if (!response.ok) {
        // Fall back to text generation API
        const textResponse = await fetch(`${this.baseUrl}/models/${modelId}`, {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify({
            inputs: prompt,
            parameters: { max_new_tokens: options?.maxTokens ?? 2048, temperature: options?.temperature ?? 0.7 },
          }),
          signal: options?.signal,
        });
        if (!textResponse.ok) {
          const text = await textResponse.text();
          throw new Error(`HTTP ${textResponse.status}: ${text.slice(0, 200)}`);
        }
        const textData = (await textResponse.json()) as Array<{ generated_text: string }> | { generated_text: string };
        const content = Array.isArray(textData) ? textData[0]?.generated_text?.replace(prompt, "").trim() : textData.generated_text?.replace(prompt, "").trim();
        return { content: content || "", model: modelId };
      }

      const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
      return { content: data.choices?.[0]?.message?.content || "", model: modelId };
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  async *stream(
    _messages: LlmMessage[],
    _model?: string,
    _options?: StreamOptions,
  ): AsyncGenerator<StreamChunk> {
    // Streaming via HF Inference API has limited support; use non-streaming fallback
    yield { type: "text", content: "[HuggingFace streaming support is limited. Use complete() for non-streaming.]" };
    yield { type: "done" };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: "microsoft/Phi-3-mini-4k-instruct", name: "Phi-3 Mini", provider: this.name, capabilities: { streaming: false, functionCalling: false, vision: false, maxContextWindow: 4096, maxOutputTokens: 2048, supportsSystemPrompt: true }, isFree: true },
      { id: "microsoft/Phi-3.5-mini-instruct", name: "Phi-3.5 Mini", provider: this.name, capabilities: { streaming: false, functionCalling: false, vision: false, maxContextWindow: 4096, maxOutputTokens: 2048, supportsSystemPrompt: true }, isFree: true },
      { id: "HuggingFaceH4/zephyr-7b-beta", name: "Zephyr 7B", provider: this.name, capabilities: { streaming: false, functionCalling: false, vision: false, maxContextWindow: 4096, maxOutputTokens: 2048, supportsSystemPrompt: true }, isFree: true },
    ];
  }

  async health(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/models`, { headers: this.getHeaders() });
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
