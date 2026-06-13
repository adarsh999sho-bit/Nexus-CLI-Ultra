import { VectorStore } from "./vector-store";
import type { ContextPiece, RelevanceScore } from "./types";
import { getLogger } from "../shared/logger";

export interface RetrievalResult {
  pieces: ContextPiece[];
  tookMs: number;
}

export class SemanticRetriever {
  private vectorStore: VectorStore;
  private log = getLogger();

  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore;
  }

  /** Retrieve context pieces relevant to a query */
  retrieve(
    query: string,
    maxTokens: number = 4000,
    options?: {
      includeKeyword?: boolean;
      maxResults?: number;
    },
  ): RetrievalResult {
    const start = Date.now();
    const maxResults = options?.maxResults ?? 15;

    // Search vector store
    const results = this.vectorStore.search(query, maxResults);

    const pieces: ContextPiece[] = [];
    let tokenCount = 0;

    for (const result of results) {
      if (tokenCount >= maxTokens) break;

      const tokens = this.countTokens(result.entry.content);
      if (tokenCount + tokens > maxTokens) {
        // Truncate content to fit
        const truncated = result.entry.content.slice(0, maxTokens * 4 - tokenCount);
        pieces.push({
          type: "file",
          source: result.entry.file,
          content: truncated,
          relevance: {
            semantic: result.score,
            keyword: result.score,
            recency: 0.5,
            priority: result.score,
          },
          tokenCount: this.countTokens(truncated),
        });
        break;
      }

      pieces.push({
        type: "file",
        source: result.entry.file,
        content: result.entry.content,
        relevance: {
          semantic: result.score,
          keyword: result.score,
          recency: 0.5,
          priority: result.score,
        },
        tokenCount: tokens,
      });
      tokenCount += tokens;
    }

    this.log.debug(`Retrieved ${pieces.length} pieces for query in ${Date.now() - start}ms`);
    return { pieces, tookMs: Date.now() - start };
  }

  /** Retrieve context for a specific file */
  retrieveByFile(file: string): ContextPiece[] {
    const entries = this.vectorStore.searchByFile(file);
    return entries.map((entry) => ({
      type: "file" as const,
      source: entry.file,
      content: entry.content,
      relevance: {
        semantic: 1.0,
        keyword: 1.0,
        recency: 0.5,
        priority: 1.0,
      },
      tokenCount: this.countTokens(entry.content),
    }));
  }

  /** Retrieve context by symbol name */
  retrieveBySymbol(symbolName: string): ContextPiece[] {
    const entries = this.vectorStore.searchBySymbol(symbolName);
    return entries.map((entry) => ({
      type: "file" as const,
      source: entry.file,
      content: entry.content,
      relevance: {
        semantic: 0.9,
        keyword: 0.9,
        recency: 0.5,
        priority: 0.9,
      },
      tokenCount: this.countTokens(entry.content),
    }));
  }

  /** Simple token count estimator */
  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
