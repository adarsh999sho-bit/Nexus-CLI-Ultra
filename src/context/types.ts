/** Classification of a file in the repository */
export type FileCategory = "code" | "config" | "test" | "docs" | "binary" | "generated" | "unknown";

/** A file entry in the repository index */
export interface FileEntry {
  path: string;
  category: FileCategory;
  language: string;
  size: number;
  lines: number;
  lastModified: Date;
  /** Whether this file is gitignored */
  isIgnored: boolean;
}

/** A code symbol extracted by the AST parser */
export interface SymbolInfo {
  name: string;
  type: "function" | "class" | "interface" | "type" | "variable" | "import" | "export";
  file: string;
  line: number;
  column: number;
  /** File paths that this symbol references */
  references: string[];
  /** Doc comment extracted from code */
  docComment?: string;
}

/** A chunk of code with its embedding */
export interface CodeChunk {
  id: string;
  file: string;
  startLine: number;
  endLine: number;
  content: string;
  symbols: string[];
  embedding?: Float32Array;
}

/** Relevance score for a piece of context */
export interface RelevanceScore {
  semantic: number;    // 0-1 cosine similarity
  keyword: number;     // 0-1 keyword match score
  recency: number;     // 0-1 how recently modified
  priority: number;    // 0-1 combined with weights
}

/** A piece of assembled context for the LLM prompt */
export interface ContextPiece {
  type: "file" | "symbol" | "diff" | "summary" | "memory";
  source: string;
  content: string;
  relevance: RelevanceScore;
  tokenCount: number;
}

/** The assembled context package ready for the LLM */
export interface ContextPackage {
  pieces: ContextPiece[];
  totalTokens: number;
  query: string;
  files: string[];
  hasGitDiff: boolean;
}

/** Memory types for the 4-tier system */
export type MemoryLevel = "working" | "session" | "repository" | "user";

/** A memory entry */
export interface MemoryEntry {
  id: string;
  level: MemoryLevel;
  content: string;
  tags: string[];
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  decayScore: number;
}

/** Configuration for context assembly */
export interface ContextConfig {
  maxTokens: number;
  includeGitDiff: boolean;
  includeSimilarFiles: boolean;
  compressionLevel: "none" | "light" | "aggressive";
  memoryLevels: MemoryLevel[];
}
