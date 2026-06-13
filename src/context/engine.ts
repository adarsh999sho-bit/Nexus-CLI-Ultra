import { RepositoryScanner } from "./scanner";
import { FileIndexer } from "./indexer";
import { VectorStore } from "./vector-store";
import { SemanticRetriever } from "./retriever";
import { RelevanceRanker } from "./ranker";
import { ContextCompactor } from "./compactor";
import { ContextAssembler } from "./assembler";
import { GitContext } from "./git-aware";
import { MemoryManager } from "./memory";
import type { ContextPackage, ContextConfig, FileEntry, SymbolInfo, CodeChunk } from "./types";
import { getLogger } from "../shared/logger";

export class ContextEngine {
  private scanner: RepositoryScanner;
  private indexer: FileIndexer;
  private vectorStore: VectorStore;
  private retriever: SemanticRetriever;
  private ranker: RelevanceRanker;
  private compactor: ContextCompactor;
  private assembler: ContextAssembler;
  private git: GitContext;
  private memory: MemoryManager;
  private log = getLogger();
  private isInitialized = false;

  constructor() {
    this.scanner = new RepositoryScanner();
    this.indexer = new FileIndexer();
    this.vectorStore = new VectorStore();
    this.retriever = new SemanticRetriever(this.vectorStore);
    this.ranker = new RelevanceRanker();
    this.compactor = new ContextCompactor();
    this.git = new GitContext();
    this.memory = new MemoryManager();
    this.assembler = new ContextAssembler(this.retriever, this.ranker, this.compactor, this.git);
  }

  /** Initialize the context engine by scanning and indexing the repository */
  async initialize(options?: { maxFiles?: number }): Promise<void> {
    const start = Date.now();
    this.log.info("Initializing context engine...");

    // 1. Scan files
    const files = this.scanner.scan(process.cwd(), options?.maxFiles ?? 1000);
    this.log.info(`Scanned ${files.length} files`);

    // 2. Index code files
    const codeFiles = files.filter((f) => f.category === "code" || f.category === "test");
    let totalChunks = 0;

    for (const file of codeFiles) {
      try {
        const content = this.scanner.readFile(file.path);
        if (!content) continue;
        const { symbols, chunks } = this.indexer.indexFile(file.path, content);
        totalChunks += chunks.length;
        await this.vectorStore.addChunks(chunks);
      } catch (err) {
        this.log.warn(`Failed to index ${file.path}`, { error: String(err) });
      }
    }

    this.isInitialized = true;
    this.log.info(
      `Context engine initialized: ${files.length} files, ${totalChunks} chunks indexed in ${Date.now() - start}ms`,
    );
  }

  /** Get the scanner instance */
  getScanner(): RepositoryScanner {
    return this.scanner;
  }

  /** Get the indexer instance */
  getIndexer(): FileIndexer {
    return this.indexer;
  }

  /** Get the vector store instance */
  getVectorStore(): VectorStore {
    return this.vectorStore;
  }

  /** Get the retriever instance */
  getRetriever(): SemanticRetriever {
    return this.retriever;
  }

  /** Get the ranker instance */
  getRanker(): RelevanceRanker {
    return this.ranker;
  }

  /** Get the compactor instance */
  getCompactor(): ContextCompactor {
    return this.compactor;
  }

  /** Get the assembler instance */
  getAssembler(): ContextAssembler {
    return this.assembler;
  }

  /** Get the git context instance */
  getGit(): GitContext {
    return this.git;
  }

  /** Get the memory manager instance */
  getMemory(): MemoryManager {
    return this.memory;
  }

  /** Full query → context pipeline */
  async query(userQuery: string, config?: Partial<ContextConfig>): Promise<ContextPackage> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Store in working memory
    this.memory.setWorking("lastQuery", userQuery);

    // Assemble context
    const pkg = await this.assembler.assemble(userQuery, config);

    // Store in session memory
    this.memory.setSession(`query:${Date.now()}`, userQuery);

    return pkg;
  }

  /** Semantic search */
  search(query: string, maxResults?: number): Array<{ file: string; score: number; snippet: string }> {
    const results = this.vectorStore.search(query, maxResults ?? 10);
    return results.map((r) => ({
      file: r.entry.file,
      score: r.score,
      snippet: r.entry.content.slice(0, 200),
    }));
  }

  /** Search by symbol name */
  searchSymbol(name: string): Array<{ file: string; line: number }> {
    const entries = this.vectorStore.searchBySymbol(name);
    return entries.map((e) => ({ file: e.file, line: e.startLine }));
  }

  /** Index a specific file */
  indexFile(filePath: string): { symbols: SymbolInfo[]; chunks: CodeChunk[] } | null {
    const content = this.scanner.readFile(filePath);
    if (!content) return null;
    const result = this.indexer.indexFile(filePath, content);
    this.vectorStore.addChunks(result.chunks);
    return result;
  }

  /** Get list of all scanned files */
  getFiles(): FileEntry[] {
    return this.scanner.scan(process.cwd(), 1000);
  }

  /** Clear and reinitialize */
  async reinitialize(): Promise<void> {
    this.vectorStore.clear();
    this.isInitialized = false;
    await this.initialize();
  }
}

let _engine: ContextEngine | null = null;

export function getContextEngine(): ContextEngine {
  _engine ||= new ContextEngine();
  return _engine;
}

export function resetContextEngine(): void {
  _engine = null;
}
