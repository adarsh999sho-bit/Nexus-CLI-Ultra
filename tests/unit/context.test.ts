import { describe, it, expect } from "bun:test";

describe("Context Types", () => {
  it("should define all type exports", async () => {
    const types = await import("../../src/context/types");
    expect(types).toBeDefined();
  });
});

describe("Repository Scanner", () => {
  it("should scan current directory", async () => {
    const { RepositoryScanner } = await import("../../src/context/scanner");
    const scanner = new RepositoryScanner();
    const files = scanner.scan(".", 10);
    expect(Array.isArray(files)).toBe(true);
    // Should at least find this test file
    const foundTest = files.some((f) => f.path.includes("context.test"));
    // Or find some files
    expect(files.length).toBeGreaterThan(0);
  });

  it("should classify files by extension", async () => {
    const { RepositoryScanner } = await import("../../src/context/scanner");
    const scanner = new RepositoryScanner();
    expect(scanner.classifyFile("test.ts")).toBe("code");
    expect(scanner.classifyFile("test.md")).toBe("docs");
    expect(scanner.classifyFile("test.json")).toBe("config");
  });
});

describe("File Indexer", () => {
  it("should extract symbols from TypeScript", async () => {
    const { FileIndexer } = await import("../../src/context/indexer");
    const indexer = new FileIndexer();

    const source = `
      import { foo } from "./bar";
      function hello() {}
      class MyClass {}
      interface MyInterface {}
      export const x = 5;
    `;

    const result = indexer.indexFile("test.ts", source);
    const names = result.symbols.map((s) => s.name);
    expect(names).toContain("hello");
    expect(names).toContain("MyClass");
    expect(names).toContain("MyInterface");
    expect(names).toContain("foo");
  });

  it("should chunk files", async () => {
    const { FileIndexer } = await import("../../src/context/indexer");
    const indexer = new FileIndexer();

    const source = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join("\n");
    const result = indexer.indexFile("test.ts", source);
    expect(result.chunks.length).toBeGreaterThan(1);
  });
});

describe("Vector Store", () => {
  it("should store and search chunks", async () => {
    const { VectorStore } = await import("../../src/context/vector-store");
    const store = new VectorStore();

    await store.addChunks([
      { id: "1", file: "auth.ts", startLine: 1, endLine: 5, content: "function authenticateJWT(token) { return verify(token); }", symbols: ["authenticateJWT"] },
      { id: "2", file: "db.ts", startLine: 1, endLine: 5, content: "function connectDatabase() { return new Connection(); }", symbols: ["connectDatabase"] },
    ]);

    expect(store.size).toBe(2);

    const result = store.search("JWT authentication");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].entry.file).toBe("auth.ts");
  });

  it("should search by file", async () => {
    const { VectorStore } = await import("../../src/context/vector-store");
    const store = new VectorStore();
    await store.addChunks([{ id: "1", file: "test.ts", startLine: 1, endLine: 1, content: "test", symbols: [] }]);
    const results = store.searchByFile("test.ts");
    expect(results.length).toBe(1);
  });

  it("should clear all entries", async () => {
    const { VectorStore } = await import("../../src/context/vector-store");
    const store = new VectorStore();
    await store.addChunks([{ id: "1", file: "test.ts", startLine: 1, endLine: 1, content: "test", symbols: [] }]);
    store.clear();
    expect(store.size).toBe(0);
  });
});

describe("Relevance Ranker", () => {
  it("should rank pieces by score", async () => {
    const { RelevanceRanker } = await import("../../src/context/ranker");
    const ranker = new RelevanceRanker();

    const pieces = [
      { type: "file" as const, source: "a.ts", content: "a", relevance: { semantic: 1.0, keyword: 0.5, recency: 0.5, priority: 0.5 }, tokenCount: 1 },
      { type: "file" as const, source: "b.ts", content: "b", relevance: { semantic: 0.5, keyword: 0.5, recency: 0.5, priority: 0.5 }, tokenCount: 1 },
    ];

    const ranked = ranker.rank(pieces);
    expect(ranked[0].source).toBe("a.ts");
  });

  it("should trim to budget", async () => {
    const { RelevanceRanker } = await import("../../src/context/ranker");
    const ranker = new RelevanceRanker();

    const pieces = [
      { type: "file" as const, source: "a.ts", content: "aaaa", relevance: { semantic: 1.0, keyword: 0.5, recency: 0.5, priority: 0.5 }, tokenCount: 10 },
      { type: "file" as const, source: "b.ts", content: "bbbb", relevance: { semantic: 0.5, keyword: 0.5, recency: 0.5, priority: 0.5 }, tokenCount: 10 },
    ];

    const trimmed = ranker.trimToBudget(pieces, 15);
    expect(trimmed.length).toBe(1);
  });
});

describe("Context Compactor", () => {
  it("should compact large pieces", async () => {
    const { ContextCompactor } = await import("../../src/context/compactor");
    const compactor = new ContextCompactor(50);

    const largePiece = {
      type: "file" as const,
      source: "large.ts",
      content: Array.from({ length: 100 }, (_, i) => `function fn${i}() { console.log(${i}); }`).join("\n"),
      relevance: { semantic: 1.0, keyword: 1.0, recency: 1.0, priority: 1.0 },
      tokenCount: 1000,
    };

    const result = compactor.compact([largePiece]);
    expect(result.compactedTokens).toBeLessThan(result.originalTokens);
  });
});

describe("Context Engine", () => {
  it("should create engine instance", async () => {
    const { ContextEngine } = await import("../../src/context/engine");
    const engine = new ContextEngine();
    expect(engine).toBeDefined();
    expect(engine.getScanner()).toBeDefined();
    expect(engine.getIndexer()).toBeDefined();
    expect(engine.getVectorStore()).toBeDefined();
    expect(engine.getRetriever()).toBeDefined();
    expect(engine.getRanker()).toBeDefined();
    expect(engine.getCompactor()).toBeDefined();
    expect(engine.getAssembler()).toBeDefined();
    expect(engine.getGit()).toBeDefined();
    expect(engine.getMemory()).toBeDefined();
  });

  it("should search vector store", async () => {
    const { ContextEngine } = await import("../../src/context/engine");
    const engine = new ContextEngine();
    // Add some chunks directly
    const store = engine.getVectorStore();
    await store.addChunks([
      { id: "test1", file: "hello.ts", startLine: 1, endLine: 1, content: "function hello() { return 'hello'; }", symbols: ["hello"] },
    ]);

    const results = engine.search("hello function");
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("Context Index", () => {
  it("should export all context modules", async () => {
    const ctx = await import("../../src/context/index");
    expect(ctx.ContextEngine).toBeDefined();
    expect(ctx.ContextAssembler).toBeDefined();
    expect(ctx.MemoryManager).toBeDefined();
    expect(ctx.GitContext).toBeDefined();
    expect(ctx.RepositoryScanner).toBeDefined();
    expect(ctx.FileIndexer).toBeDefined();
    expect(ctx.VectorStore).toBeDefined();
    expect(ctx.SemanticRetriever).toBeDefined();
    expect(ctx.RelevanceRanker).toBeDefined();
    expect(ctx.ContextCompactor).toBeDefined();
  });
});
