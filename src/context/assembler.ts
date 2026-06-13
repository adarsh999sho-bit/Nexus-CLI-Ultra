import type { ContextPiece, ContextPackage, ContextConfig } from "./types";
import { SemanticRetriever } from "./retriever";
import { RelevanceRanker } from "./ranker";
import { ContextCompactor } from "./compactor";
import { GitContext } from "./git-aware";
import { getLogger } from "../shared/logger";

export class ContextAssembler {
  private retriever: SemanticRetriever;
  private ranker: RelevanceRanker;
  private compactor: ContextCompactor;
  private git: GitContext;
  private log = getLogger();

  constructor(
    retriever: SemanticRetriever,
    ranker?: RelevanceRanker,
    compactor?: ContextCompactor,
    git?: GitContext,
  ) {
    this.retriever = retriever;
    this.ranker = ranker || new RelevanceRanker();
    this.compactor = compactor || new ContextCompactor();
    this.git = git || new GitContext();
  }

  /** Assemble an optimized context package for a user query */
  async assemble(
    query: string,
    config?: Partial<ContextConfig>,
  ): Promise<ContextPackage> {
    const cfg: ContextConfig = {
      maxTokens: config?.maxTokens ?? 4000,
      includeGitDiff: config?.includeGitDiff ?? true,
      includeSimilarFiles: config?.includeSimilarFiles ?? true,
      compressionLevel: config?.compressionLevel ?? "light",
      memoryLevels: config?.memoryLevels ?? ["working", "session", "repository"],
    };

    const start = Date.now();
    const allPieces: ContextPiece[] = [];

    // 1. Semantic retrieval
    if (cfg.includeSimilarFiles) {
      const { pieces } = this.retriever.retrieve(query, cfg.maxTokens);
      allPieces.push(...pieces);
    }

    // 2. Git context
    if (cfg.includeGitDiff && this.git.isGitRepo()) {
      const diffs = this.git.getAllDiffs();
      if (diffs.length > 0) {
        const diffPieces = this.git.diffsToContext(diffs);
        // Add git summary as first piece
        const summary = this.git.getGitSummary();
        if (summary) {
          allPieces.unshift({
            type: "summary",
            source: "git",
            content: summary,
            relevance: { semantic: 0.7, keyword: 0.5, recency: 1.0, priority: 0.9 },
            tokenCount: Math.ceil(summary.length / 4),
          });
        }
        allPieces.push(...diffPieces);
      }
    }

    // 3. Rank by relevance
    const ranked = this.ranker.rank(allPieces);

    // 4. Compact if needed
    const compacted = cfg.compressionLevel !== "none"
      ? this.compactor.compact(ranked).pieces
      : ranked;

    // 5. Trim to token budget
    const trimmed = this.ranker.trimToBudget(compacted, cfg.maxTokens);

    const totalTokens = trimmed.reduce((s, p) => s + p.tokenCount, 0);
    const files = [...new Set(trimmed.map((p) => p.source))];

    this.log.debug(
      `Assembled context: ${trimmed.length} pieces, ${totalTokens} tokens, ${files.length} files in ${Date.now() - start}ms`,
    );

    return {
      pieces: trimmed,
      totalTokens,
      query,
      files,
      hasGitDiff: allPieces.some((p) => p.type === "diff"),
    };
  }

  /** Format the context package into a string prompt */
  formatPackage(pkg: ContextPackage): string {
    const parts: string[] = [];

    parts.push(`# Context for: ${pkg.query}\n`);

    if (pkg.hasGitDiff) {
      parts.push("## Git Changes\n");
      parts.push("There are uncommitted changes in the repository.\n");
    }

    parts.push(`## Relevant Files (${pkg.files.length})\n`);
    for (const file of pkg.files) {
      parts.push(`- ${file}`);
    }
    parts.push("");

    for (const piece of pkg.pieces) {
      if (piece.type === "file") {
        parts.push(`### File: ${piece.source}`);
        parts.push("```");
        parts.push(piece.content);
        parts.push("```\n");
      } else if (piece.type === "diff") {
        parts.push(`### Changes: ${piece.source}`);
        parts.push("```diff");
        parts.push(piece.content);
        parts.push("```\n");
      } else if (piece.type === "summary") {
        parts.push(`### Summary: ${piece.source}`);
        parts.push(piece.content);
        parts.push("");
      }
    }

    parts.push(`\n[Context total: ${pkg.totalTokens} tokens across ${pkg.pieces.length} pieces]`);
    return parts.join("\n");
  }

  /** Format the context as a compact strategy for use with an LLM */
  formatInstructions(): string {
    return `You are Nexus CLI Ultra, an AI engineering agent with access to the repository context.
Follow these rules:
1. Only use information from the provided context files
2. If you need more context, state what files would be helpful
3. Prioritize accuracy over completeness
4. When suggesting code changes, reference the specific file and line numbers
5. Use the existing code style and patterns in the repository`;
  }
}
