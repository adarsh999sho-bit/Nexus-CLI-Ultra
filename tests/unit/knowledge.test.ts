import { describe, it, expect } from "bun:test";

describe("Knowledge Types", () => {
  it("should define all type exports", async () => {
    const types = await import("../../src/knowledge/types");
    expect(types).toBeDefined();
  });
});

describe("Knowledge Graph", () => {
  it("should add and retrieve nodes", async () => {
    const { KnowledgeGraphBuilder } = await import("../../src/knowledge/graph");
    const graph = new KnowledgeGraphBuilder();

    graph.addNode({ id: "file:test.ts", type: "file", name: "test.ts", metadata: {} });
    graph.addNode({ id: "symbol:hello", type: "symbol", name: "hello", file: "test.ts", line: 1, metadata: {} });

    const node = graph.getNode("file:test.ts");
    expect(node).toBeDefined();
    expect(node!.name).toBe("test.ts");
    expect(graph.nodeCount).toBe(2);
  });

  it("should add and query edges", async () => {
    const { KnowledgeGraphBuilder } = await import("../../src/knowledge/graph");
    const graph = new KnowledgeGraphBuilder();

    graph.addNode({ id: "file:a.ts", type: "file", name: "a.ts", metadata: {} });
    graph.addNode({ id: "file:b.ts", type: "file", name: "b.ts", metadata: {} });
    graph.addEdge({ source: "file:a.ts", target: "file:b.ts", type: "imports", weight: 1 });

    const edges = graph.findEdges("file:a.ts");
    expect(edges.length).toBe(1);
    expect(edges[0].type).toBe("imports");
  });

  it("should build from dependencies", async () => {
    const { KnowledgeGraphBuilder } = await import("../../src/knowledge/graph");
    const graph = new KnowledgeGraphBuilder();

    graph.buildFromDependencies([
      { path: "src/main.ts", imports: ["src/utils.ts"], type: "code" },
      { path: "src/utils.ts", imports: [], type: "code" },
    ]);

    expect(graph.nodeCount).toBeGreaterThanOrEqual(2);
    expect(graph.edgeCount).toBeGreaterThanOrEqual(1);
  });

  it("should perform impact analysis", async () => {
    const { KnowledgeGraphBuilder } = await import("../../src/knowledge/graph");
    const graph = new KnowledgeGraphBuilder();

    graph.buildFromDependencies([
      { path: "src/auth.ts", imports: ["src/utils.ts"], type: "code" },
      { path: "src/utils.ts", imports: [], type: "code" },
      { path: "tests/auth.test.ts", imports: ["src/auth.ts"], type: "test" },
    ]);

    const impact = graph.analyzeImpact("auth.ts");
    expect(impact).toBeDefined();
    expect(["low", "medium", "high"]).toContain(impact.changeComplexity);
  });

  it("should export to JSON", async () => {
    const { KnowledgeGraphBuilder } = await import("../../src/knowledge/graph");
    const graph = new KnowledgeGraphBuilder();
    graph.addNode({ id: "n1", type: "file", name: "f1", metadata: {} });

    const json = graph.toJSON();
    expect(json.nodes.length).toBe(1);
    expect(json.edges).toEqual([]);
  });

  it("should clear the graph", async () => {
    const { KnowledgeGraphBuilder } = await import("../../src/knowledge/graph");
    const graph = new KnowledgeGraphBuilder();
    graph.addNode({ id: "n1", type: "file", name: "f1", metadata: {} });
    graph.clear();
    expect(graph.nodeCount).toBe(0);
  });
});

describe("Symbol Index", () => {
  it("should index file symbols", async () => {
    const { SymbolIndex } = await import("../../src/knowledge/symbol-index");
    const index = new SymbolIndex();

    index.indexFile("test.ts", `
      import { foo } from "./bar";
      function hello() {}
      class MyClass {}
      interface MyInterface {}
    `);

    expect(index.count).toBeGreaterThan(0);
    expect(index.getAllSymbols().length).toBeGreaterThan(0);
  });

  it("should find symbol references", async () => {
    const { SymbolIndex } = await import("../../src/knowledge/symbol-index");
    const index = new SymbolIndex();

    index.indexFile("test.ts", `
      function hello() {}
      hello();
    `);

    const refs = index.findReferences("hello");
    expect(refs.length).toBeGreaterThan(0);
  });

  it("should find unused symbols", async () => {
    const { SymbolIndex } = await import("../../src/knowledge/symbol-index");
    const index = new SymbolIndex();

    index.indexFile("a.ts", `
      export function used() { return 1; }
      export function unused() { return 2; }
    `);
    index.indexFile("b.ts", `
      import { used } from "./a";
      console.log(used());
    `);

    const unused = index.findUnusedSymbols();
    expect(unused.some((s) => s.symbol === "unused")).toBe(true);
  });

  it("should group symbols by file", async () => {
    const { SymbolIndex } = await import("../../src/knowledge/symbol-index");
    const index = new SymbolIndex();
    index.indexFile("test.ts", `function f1() {} function f2() {}`);
    const byFile = index.getSymbolsByFile();
    expect(byFile.size).toBeGreaterThan(0);
  });
});

describe("Dependency Analyzer", () => {
  it("should create and report type", async () => {
    const { DependencyAnalyzer } = await import("../../src/knowledge/dependency");
    const analyzer = new DependencyAnalyzer();
    expect(analyzer).toBeDefined();
  });

  it("should extract imports from code", async () => {
    const { DependencyAnalyzer } = await import("../../src/knowledge/dependency");
    const analyzer = new DependencyAnalyzer();

    const result = analyzer.analyze(
      [".gitkeep"],
      ".",
    );
    expect(result).toBeDefined();
    expect(typeof result.files).toBe("number");
  });
});

describe("Architecture Generator", () => {
  it("should generate system diagrams", async () => {
    const { ArchitectureGenerator } = await import("../../src/knowledge/architecture");
    const gen = new ArchitectureGenerator();

    const diagram = gen.generateSystemDiagram([
      { name: "Auth", description: "Authentication", dependencies: ["Database"] },
      { name: "API", description: "API layer", dependencies: ["Auth"] },
      { name: "Database", description: "Data storage", dependencies: [] },
    ]);

    expect(diagram.type).toBe("system");
    expect(diagram.mermaid).toContain("graph TB");
  });

  it("should generate API diagrams", async () => {
    const { ArchitectureGenerator } = await import("../../src/knowledge/architecture");
    const gen = new ArchitectureGenerator();

    const diagram = gen.generateApiDiagram([
      { method: "GET", path: "/users", handler: "getUsers" },
    ]);

    expect(diagram.type).toBe("api");
    expect(diagram.mermaid).toContain("graph LR");
  });
});

describe("Schema Inferrer", () => {
  it("should detect Prisma models", async () => {
    const { SchemaInferrer } = await import("../../src/knowledge/database");
    const inferrer = new SchemaInferrer();

    const result = inferrer.inferFromFiles([
      {
        path: "schema.prisma",
        content: `
          model User {
            id Int @id
            name String?
            email String
          }
        `,
      },
    ]);

    expect(result.tables.length).toBeGreaterThan(0);
    expect(result.tables.some((t) => t.name === "User")).toBe(true);
  });

  it("should generate ERD diagrams", async () => {
    const { SchemaInferrer } = await import("../../src/knowledge/database");
    const inferrer = new SchemaInferrer();

    const schema = inferrer.inferFromFiles([
      {
        path: "schema.prisma",
        content: `
          model User { id Int @id }
          model Post { id Int @id }
        `,
      },
    ]);

    const erd = inferrer.toMermaidERD(schema);
    expect(erd).toContain("erDiagram");
  });
});

describe("Knowledge Index", () => {
  it("should export all modules", async () => {
    const knowledge = await import("../../src/knowledge/index");
    expect(knowledge.KnowledgeGraphBuilder).toBeDefined();
    expect(knowledge.SymbolIndex).toBeDefined();
    expect(knowledge.DependencyAnalyzer).toBeDefined();
    expect(knowledge.ArchitectureGenerator).toBeDefined();
    expect(knowledge.SchemaInferrer).toBeDefined();
  });
});
