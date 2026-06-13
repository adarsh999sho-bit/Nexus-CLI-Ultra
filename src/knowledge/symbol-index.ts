import { readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { getLogger } from "../shared/logger";

interface SymbolReference {
  symbol: string;
  file: string;
  line: number;
  type: "definition" | "reference" | "import";
}

export class SymbolIndex {
  private symbols: Map<string, SymbolReference[]> = new Map();
  private log = getLogger();

  /** Index symbols in a file */
  indexFile(filePath: string, content?: string): void {
    const fullPath = join(process.cwd(), filePath);
    const source = content || readFileSync(fullPath, "utf-8");
    const lines = source.split("\n");
    const ext = extname(filePath).toLowerCase();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Detect definitions
      this.detectDefinitions(filePath, line, lineNum);

      // Detect references
      this.detectReferences(filePath, line, lineNum);

      // Detect imports
      this.detectImports(filePath, line, lineNum, ext);
    }
  }

  /** Find all files that reference a symbol */
  findReferences(symbol: string): SymbolReference[] {
    const lower = symbol.toLowerCase();
    const results: SymbolReference[] = [];

    for (const [name, refs] of this.symbols) {
      if (name.toLowerCase().includes(lower)) {
        results.push(...refs);
      }
    }

    return results;
  }

  /** Find all definitions of a symbol */
  findDefinitions(symbol: string): SymbolReference[] {
    return this.findReferences(symbol).filter((r) => r.type === "definition");
  }

  /** Get all unique symbols */
  getAllSymbols(): string[] {
    return Array.from(this.symbols.keys());
  }

  /** Get symbols grouped by file */
  getSymbolsByFile(): Map<string, string[]> {
    const byFile = new Map<string, string[]>();
    for (const [symbol, refs] of this.symbols) {
      for (const ref of refs) {
        if (ref.type === "definition") {
          const existing = byFile.get(ref.file) || [];
          existing.push(symbol);
          byFile.set(ref.file, existing);
        }
      }
    }
    return byFile;
  }

  /** Check if a symbol is unused (defined but never referenced by other files) */
  findUnusedSymbols(): Array<{ symbol: string; file: string; line: number }> {
    const unused: Array<{ symbol: string; file: string; line: number }> = [];

    for (const [symbol, refs] of this.symbols) {
      const defs = refs.filter((r) => r.type === "definition");
      const references = refs.filter((r) => r.type === "reference" || r.type === "import");

      for (const def of defs) {
        // A symbol is unused if it has no references outside its own file
        const externalRefs = references.filter((r) => r.file !== def.file);
        if (externalRefs.length === 0) {
          unused.push({ symbol, file: def.file, line: def.line });
        }
      }
    }

    return unused;
  }

  /** Clear the index */
  clear(): void {
    this.symbols.clear();
  }

  /** Get symbol count */
  get count(): number {
    return this.symbols.size;
  }

  /** Get the index as a JSON-serializable object */
  toJSON(): Record<string, SymbolReference[]> {
    const obj: Record<string, SymbolReference[]> = {};
    for (const [key, val] of this.symbols) {
      obj[key] = val;
    }
    return obj;
  }

  private addSymbol(symbol: string, ref: SymbolReference): void {
    const existing = this.symbols.get(symbol) || [];
    existing.push(ref);
    this.symbols.set(symbol, existing);
  }

  private detectDefinitions(filePath: string, line: string, lineNum: number): void {
    const patterns = [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]+)\s*=>/,
      /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
      /(?:export\s+)?interface\s+(\w+)/,
      /(?:export\s+)?type\s+(\w+)\s*=/,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        this.addSymbol(match[1], {
          symbol: match[1],
          file: filePath,
          line: lineNum,
          type: "definition",
        });
      }
    }
  }

  private detectReferences(filePath: string, line: string, lineNum: number): void {
    // Match symbol references like `someFunction(` or `new SomeClass(`
    const refPattern = /(?:\b|\.)([a-zA-Z_$]\w*)\s*[\(\.]/g;
    let match: RegExpExecArray | null;
    while ((match = refPattern.exec(line)) !== null) {
      if (match[1]) {
        this.addSymbol(match[1], {
          symbol: match[1],
          file: filePath,
          line: lineNum,
          type: "reference",
        });
      }
    }
  }

  private detectImports(filePath: string, line: string, lineNum: number, _ext: string): void {
    const importPattern = /import\s+(?:\w+\s*,?\s*)?\{?\s*(\w+)\s*\}?\s*from\s+['"]/;
    const requirePattern = /const\s+(\w+)\s*=\s*require\(/;

    const importMatch = line.match(importPattern);
    if (importMatch && importMatch[1]) {
      this.addSymbol(importMatch[1], {
        symbol: importMatch[1],
        file: filePath,
        line: lineNum,
        type: "import",
      });
    }

    const requireMatch = line.match(requirePattern);
    if (requireMatch && requireMatch[1]) {
      this.addSymbol(requireMatch[1], {
        symbol: requireMatch[1],
        file: filePath,
        line: lineNum,
        type: "import",
      });
    }
  }
}
