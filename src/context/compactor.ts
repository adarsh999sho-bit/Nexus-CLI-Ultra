import type { ContextPiece } from "./types";

export interface CompactionResult {
  originalTokens: number;
  compactedTokens: number;
  pieces: ContextPiece[];
}

export class ContextCompactor {
  private maxTokensPerPiece: number;

  constructor(maxTokensPerPiece: number = 500) {
    this.maxTokensPerPiece = maxTokensPerPiece;
  }

  /** Compress context pieces that exceed the token limit */
  compact(pieces: ContextPiece[]): CompactionResult {
    const originalTokens = pieces.reduce((s, p) => s + p.tokenCount, 0);
    const compacted: ContextPiece[] = [];

    for (const piece of pieces) {
      if (piece.tokenCount <= this.maxTokensPerPiece) {
        compacted.push(piece);
      } else {
        compacted.push(this.compressPiece(piece));
      }
    }

    const compactedTokens = compacted.reduce((s, p) => s + p.tokenCount, 0);

    return { originalTokens, compactedTokens, pieces: compacted };
  }

  /** Compress a single large context piece */
  private compressPiece(piece: ContextPiece): ContextPiece {
    const lines = piece.content.split("\n");

    // Strategy: preserve public API surface + key structural elements
    const preserved: string[] = [];
    const summary: string[] = [];

    let inFunction = false;
    let functionDepth = 0;
    let preservedCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Always preserve: imports, exports, class/interface declarations, function signatures
      if (
        trimmed.startsWith("import ") ||
        trimmed.startsWith("export ") ||
        trimmed.startsWith("// ") ||
        trimmed.startsWith("/*") ||
        trimmed.startsWith("* ") ||
        trimmed.startsWith("@param") ||
        trimmed.startsWith("@returns") ||
        trimmed.startsWith("@throws") ||
        trimmed.startsWith("public ") ||
        trimmed.startsWith("private ") ||
        trimmed.startsWith("protected ") ||
        trimmed.startsWith("static ") ||
        trimmed.startsWith("class ") ||
        trimmed.startsWith("interface ") ||
        trimmed.startsWith("type ") ||
        trimmed.startsWith("enum ") ||
        trimmed.startsWith("function ") ||
        trimmed.startsWith("async function ") ||
        trimmed.match(/^\w+\s*\(/) ||  // Method shorthand
        trimmed === "}"
      ) {
        preserved.push(line);
        preservedCount++;

        if (trimmed.endsWith("{")) {
          inFunction = true;
          functionDepth++;
        }
      } else if (inFunction) {
        // Keep function bodies compressed (first few lines)
        if (functionDepth < 5) {
          preserved.push(line);
          functionDepth++;
        } else if (preservedCount > 0 && preserved[preservedCount - 1] !== "  // ...") {
          preserved.push("  // ...");
        }

        if (trimmed === "}") {
          inFunction = false;
          functionDepth = 0;
        }
      } else if (trimmed.startsWith("# ") || trimmed.startsWith("## ")) {
        // Markdown headers
        preserved.push(line);
        preservedCount++;
      } else if (trimmed.length > 0 && preservedCount < 3) {
        // Initial lines
        preserved.push(line);
        preservedCount++;
      }
    }

    const compactedContent = preserved.join("\n");

    return {
      ...piece,
      content: compactedContent,
      tokenCount: Math.ceil(compactedContent.length / 4),
    };
  }

  /** Create a summary piece from a file */
  summarize(source: string, content: string): ContextPiece {
    const lines = content.split("\n");
    const summary: string[] = [];
    const maxSummaryLines = 20;

    // Extract: module description, exports, public API
    for (let i = 0; i < Math.min(lines.length, maxSummaryLines); i++) {
      const line = lines[i];
      if (
        line.startsWith("import ") ||
        line.startsWith("export ") ||
        line.startsWith("// ") ||
        line.startsWith("/*") ||
        line.startsWith("* ") ||
        line.startsWith("function ") ||
        line.startsWith("class ") ||
        line.startsWith("interface ") ||
        line.startsWith("type ") ||
        line.startsWith("const ") ||
        line.startsWith("let ") ||
        line.startsWith("var ") ||
        line.trim() === ""
      ) {
        summary.push(line);
      }
    }

    const summaryText = summary.join("\n");

    return {
      type: "summary",
      source,
      content: summaryText,
      relevance: {
        semantic: 0.5,
        keyword: 0.5,
        recency: 0.5,
        priority: 0.5,
      },
      tokenCount: Math.ceil(summaryText.length / 4),
    };
  }
}
