import type { ContextPiece, RelevanceScore } from "./types";

export interface RankingWeights {
  semantic: number;
  keyword: number;
  recency: number;
  priority: number;
}

const DEFAULT_WEIGHTS: RankingWeights = {
  semantic: 0.4,
  keyword: 0.3,
  recency: 0.1,
  priority: 0.2,
};

export class RelevanceRanker {
  private weights: RankingWeights;

  constructor(weights: Partial<RankingWeights> = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  /** Score a context piece and return a combined relevance score */
  score(piece: ContextPiece): number {
    const r = piece.relevance;
    return (
      r.semantic * this.weights.semantic +
      r.keyword * this.weights.keyword +
      r.recency * this.weights.recency +
      r.priority * this.weights.priority
    );
  }

  /** Rank context pieces by combined score (highest first) */
  rank(pieces: ContextPiece[]): ContextPiece[] {
    return pieces
      .map((p) => ({ piece: p, score: this.score(p) }))
      .sort((a, b) => b.score - a.score)
      .map(({ piece }) => piece);
  }

  /** Trim pieces to fit within a token budget */
  trimToBudget(pieces: ContextPiece[], maxTokens: number): ContextPiece[] {
    const ranked = this.rank(pieces);
    const result: ContextPiece[] = [];
    let totalTokens = 0;

    for (const piece of ranked) {
      if (totalTokens + piece.tokenCount > maxTokens) break;
      result.push(piece);
      totalTokens += piece.tokenCount;
    }

    return result;
  }

  /** Update ranking weights */
  setWeights(weights: Partial<RankingWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  /** Get the combined score as a 0-1 value */
  normalizeScore(piece: ContextPiece): number {
    const raw = this.score(piece);
    return Math.min(1, Math.max(0, raw));
  }
}
