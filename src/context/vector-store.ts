import type { CodeChunk } from "./types";
import { getLogger } from "../shared/logger";

/**
 * Simple in-memory vector store using cosine similarity.
 * LanceDB integration can replace this when native modules are available.
 */
export interface VectorEntry {
  id: string;
  file: string;
  startLine: number;
  endLine: number;
  content: string;
  tokens: string[];
  frequency: Map<string, number>;
}

export class VectorStore {
  private entries: VectorEntry[] = [];
  private log = getLogger();
  private idfCache: Map<string, number> | null = null;

  /** Add code chunks to the store */
  async addChunks(chunks: CodeChunk[]): Promise<void> {
    for (const chunk of chunks) {
      const tokens = this.tokenize(chunk.content);
      const frequency = this.computeTermFrequency(tokens);
      this.entries.push({
        id: chunk.id,
        file: chunk.file,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content,
        tokens,
        frequency,
      });
    }
    this.idfCache = null; // Invalidate IDF cache
    this.log.debug(`Added ${chunks.length} chunks to vector store`);
  }

  /** Clear all entries */
  clear(): void {
    this.entries = [];
    this.idfCache = null;
  }

  /** Get the number of entries */
  get size(): number {
    return this.entries.length;
  }

  /** Search by keyword + TF-IDF scoring */
  search(query: string, maxResults: number = 10): Array<{ entry: VectorEntry; score: number }> {
    if (this.entries.length === 0) return [];

    const queryTokens = this.tokenize(query);
    const idf = this.computeIdf();
    const queryVector = this.computeTfIdfVector(queryTokens, idf);

    const scored = this.entries.map((entry) => {
      const docVector = this.computeTfIdfVector(Array.from(entry.frequency.keys()), idf);
      const similarity = this.cosineSimilarity(queryVector, docVector);
      // Boost exact keyword matches
      const keywordBoost = queryTokens.filter((t) => entry.content.toLowerCase().includes(t.toLowerCase())).length * 0.1;
      return { entry, score: similarity + keywordBoost };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxResults);
  }

  /** Search by file path */
  searchByFile(file: string): VectorEntry[] {
    return this.entries.filter((e) => e.file === file);
  }

  /** Search by symbol name */
  searchBySymbol(symbolName: string): VectorEntry[] {
    const lower = symbolName.toLowerCase();
    return this.entries
      .filter((e) => e.content.toLowerCase().includes(lower))
      .sort((a, b) => {
        // Prefer entries where the symbol appears earlier
        const aIdx = a.content.toLowerCase().indexOf(lower);
        const bIdx = b.content.toLowerCase().indexOf(lower);
        return aIdx - bIdx;
      });
  }

  /** Tokenize text into words */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9_$]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  }

  /** Compute term frequency for a list of tokens */
  private computeTermFrequency(tokens: string[]): Map<string, number> {
    const freq = new Map<string, number>();
    for (const token of tokens) {
      freq.set(token, (freq.get(token) || 0) + 1);
    }
    return freq;
  }

  /** Compute inverse document frequency */
  private computeIdf(): Map<string, number> {
    if (this.idfCache) return this.idfCache;

    const idf = new Map<string, number>();
    const totalDocs = this.entries.length;

    for (const entry of this.entries) {
      const uniqueTokens = new Set(entry.tokens);
      for (const token of uniqueTokens) {
        idf.set(token, (idf.get(token) || 0) + 1);
      }
    }

    for (const [token, docFreq] of idf) {
      idf.set(token, Math.log(1 + (totalDocs - docFreq + 0.5) / (docFreq + 0.5)));
    }

    this.idfCache = idf;
    return idf;
  }

  /** Compute TF-IDF vector for tokens */
  private computeTfIdfVector(tokens: string[], idf: Map<string, number>): Map<string, number> {
    const tf = this.computeTermFrequency(tokens);
    const maxFreq = Math.max(...tf.values(), 1);
    const vector = new Map<string, number>();

    for (const [token, freq] of tf) {
      const tfWeight = 0.5 + (0.5 * freq) / maxFreq;
      const idfWeight = idf.get(token) || 1;
      vector.set(token, tfWeight * idfWeight);
    }

    return vector;
  }

  /** Compute cosine similarity between two vectors */
  private cosineSimilarity(
    a: Map<string, number>,
    b: Map<string, number>,
  ): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const [key, val] of a) {
      normA += val * val;
      const bVal = b.get(key) || 0;
      dotProduct += val * bVal;
    }

    for (const val of b.values()) {
      normB += val * val;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "shall", "can",
  "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above",
  "below", "between", "out", "off", "over", "under", "again",
  "further", "then", "once", "here", "there", "when", "where",
  "why", "how", "all", "each", "every", "both", "few", "more",
  "most", "other", "some", "such", "no", "nor", "not", "only",
  "own", "same", "so", "than", "too", "very", "just", "because",
  "and", "but", "or", "if", "while", "this", "that", "these",
  "those", "it", "its", "i", "me", "my", "we", "our", "you",
  "your", "he", "him", "his", "she", "her", "they", "them",
  "their", "what", "which", "who", "whom", "return", "const",
  "let", "var", "function", "class", "import", "export", "from",
  "async", "await", "new", "try", "catch", "throw", "finally",
  "if", "else", "switch", "case", "default", "for", "while",
  "do", "break", "continue", "typeof", "instanceof", "void",
  "delete", "in", "of", "get", "set", "true", "false", "null",
  "undefined", "NaN", "Infinity", "this", "super", "yield",
  "static", "public", "private", "protected", "readonly",
  "abstract", "implements", "extends", "package", "enum",
]);

export function createVectorStore(): VectorStore {
  return new VectorStore();
}
