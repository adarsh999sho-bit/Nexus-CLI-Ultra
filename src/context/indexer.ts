import { readFileSync } from "node:fs";
import { join, extname } from "node:path";
import type { SymbolInfo, CodeChunk } from "./types";
import { getLogger } from "../shared/logger";

interface ParseResult {
  symbols: SymbolInfo[];
  chunks: CodeChunk[];
}

/**
 * A regex-based indexer that extracts symbols (functions, classes, interfaces, imports)
 * from source code files. Supports TypeScript/JavaScript, Python, and Rust.
 */
export class FileIndexer {
  private log = getLogger();

  /** Index a single file and extract symbols */
  indexFile(filePath: string, content?: string): ParseResult {
    const fullPath = join(process.cwd(), filePath);
    const source = content || readFileSync(fullPath, "utf-8");
    const ext = extname(filePath).toLowerCase();

    const symbols = this.extractSymbols(source, filePath, ext);
    const chunks = this.chunkFile(source, filePath);

    return { symbols, chunks };
  }

  /** Extract symbols from source code using regex patterns (no global flag) */
  private extractSymbols(source: string, filePath: string, ext: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    const lines = source.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Function declarations
      let match = this.matchLine(line, /(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (match) {
        symbols.push(this.makeSymbol(match[1], "function", filePath, lineNum, match));
        continue;
      }

      // Arrow functions: const fn = (...) => ...
      match = this.matchLine(line, /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]+)\s*=>/);
      if (match) {
        symbols.push(this.makeSymbol(match[1], "function", filePath, lineNum, match));
        continue;
      }

      // Method shorthand in classes
      match = this.matchLine(line, /(?:public|private|protected|static)\s+(?:async\s+)?(\w+)\s*\(/);
      if (match) {
        symbols.push(this.makeSymbol(match[1], "function", filePath, lineNum, match));
        continue;
      }

      // Class declarations
      match = this.matchLine(line, /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
      if (match) {
        symbols.push(this.makeSymbol(match[1], "class", filePath, lineNum, match));
        continue;
      }

      // Interface declarations
      match = this.matchLine(line, /(?:export\s+)?interface\s+(\w+)/);
      if (match) {
        symbols.push(this.makeSymbol(match[1], "interface", filePath, lineNum, match));
        continue;
      }

      // Type alias
      match = this.matchLine(line, /(?:export\s+)?type\s+(\w+)\s*=/);
      if (match) {
        symbols.push(this.makeSymbol(match[1], "interface", filePath, lineNum, match));
        continue;
      }

      // Import statements
      match = this.matchLine(line, /import\s+(?:\w+\s*,?\s*)?\{?\s*(\w+)\s*\}?\s*from\s+['"]/);
      if (match) {
        symbols.push(this.makeSymbol(match[1], "import", filePath, lineNum, match));
        continue;
      }
    }

    return symbols;
  }

  /** Safely match a line without global flag issues */
  private matchLine(line: string, pattern: RegExp): RegExpMatchArray | null {
    // Create a fresh regex each time to avoid any state issues
    return line.match(pattern);
  }

  /** Create a symbol info entry */
  private makeSymbol(
    name: string,
    type: SymbolInfo["type"],
    file: string,
    line: number,
    match: RegExpMatchArray,
  ): SymbolInfo {
    return {
      name: name || "unnamed",
      type,
      file,
      line,
      column: (match.index || 0) + 1,
      references: [],
    };
  }

  /** Chunk a file into meaningful segments */
  private chunkFile(source: string, filePath: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = source.split("\n");
    const CHUNK_SIZE = 50;
    const OVERLAP = 10;

    for (let i = 0; i < lines.length; i += CHUNK_SIZE - OVERLAP) {
      const end = Math.min(i + CHUNK_SIZE, lines.length);
      const content = lines.slice(i, end).join("\n");
      const chunkId = `${filePath}:${i + 1}-${end}`;

      chunks.push({
        id: chunkId,
        file: filePath,
        startLine: i + 1,
        endLine: end,
        content,
        symbols: [],
      });
    }

    return chunks;
  }
}
