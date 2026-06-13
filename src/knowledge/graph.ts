import type { GraphNode, GraphEdge, KnowledgeGraph, ImpactAnalysis } from "./types";
import { getLogger } from "../shared/logger";

export class KnowledgeGraphBuilder {
  private graph: KnowledgeGraph;
  private log = getLogger();

  constructor() {
    this.graph = { nodes: new Map(), edges: [] };
  }

  /** Add a node to the graph */
  addNode(node: GraphNode): void {
    this.graph.nodes.set(node.id, node);
  }

  /** Add an edge between two nodes */
  addEdge(edge: GraphEdge): void {
    this.graph.edges.push(edge);
  }

  /** Get a node by ID */
  getNode(id: string): GraphNode | undefined {
    return this.graph.nodes.get(id);
  }

  /** Find nodes by name */
  findByName(name: string): GraphNode[] {
    const lower = name.toLowerCase();
    return Array.from(this.graph.nodes.values()).filter(
      (n) => n.name.toLowerCase().includes(lower),
    );
  }

  /** Find edges connected to a node */
  findEdges(nodeId: string): GraphEdge[] {
    return this.graph.edges.filter(
      (e) => e.source === nodeId || e.target === nodeId,
    );
  }

  /** Get all nodes of a specific type */
  getNodesByType(type: GraphNode["type"]): GraphNode[] {
    return Array.from(this.graph.nodes.values()).filter((n) => n.type === type);
  }

  /** Get the complete graph */
  getGraph(): KnowledgeGraph {
    return this.graph;
  }

  /** Perform impact analysis for a symbol */
  analyzeImpact(symbolName: string): ImpactAnalysis {
    const nodes = this.findByName(symbolName);
    const impactedFiles: string[] = [];
    const impactedTests: string[] = [];
    const visited = new Set<string>();

    // Traverse edges to find impacted files
    for (const node of nodes) {
      this.traverseImpact(node.id, visited, impactedFiles, impactedTests);
    }

    const complexity: ImpactAnalysis["changeComplexity"] =
      impactedFiles.length <= 2 ? "low"
      : impactedFiles.length <= 5 ? "medium"
      : "high";

    return {
      symbol: symbolName,
      impactedFiles: [...new Set(impactedFiles)],
      impactedTests: [...new Set(impactedTests)],
      changeComplexity: complexity,
      suggestions: this.generateSuggestions(complexity, impactedFiles.length),
    };
  }

  /** Traverse the graph to find impacted files */
  private traverseImpact(
    nodeId: string,
    visited: Set<string>,
    files: string[],
    tests: string[],
  ): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = this.graph.nodes.get(nodeId);
    if (!node) return;

    if (node.file && !files.includes(node.file)) {
      files.push(node.file);
      if (node.type === "test") {
        tests.push(node.file);
      }
    }

    // Follow outgoing edges
    const edges = this.findEdges(nodeId);
    for (const edge of edges) {
      const nextId = edge.source === nodeId ? edge.target : edge.source;
      this.traverseImpact(nextId, visited, files, tests);
    }
  }

  /** Build graph from file dependencies */
  buildFromDependencies(
    files: Array<{ path: string; imports: string[]; type: string }>,
  ): void {
    for (const file of files) {
      // Add file node
      const fileNodeId = `file:${file.path}`;
      this.addNode({
        id: fileNodeId,
        type: file.type === "test" ? "test" : "file",
        name: file.path,
        file: file.path,
        metadata: { imports: file.imports },
      });

      // Add edges for each import
      for (const imp of file.imports) {
        const targetId = `file:${imp}`;

        // Ensure target node exists
        if (!this.graph.nodes.has(targetId)) {
          this.addNode({
            id: targetId,
            type: "module",
            name: imp,
            metadata: {},
          });
        }

        this.addEdge({
          source: fileNodeId,
          target: targetId,
          type: "imports",
          weight: 1,
        });
      }
    }

    this.log.debug(`Knowledge graph built: ${this.graph.nodes.size} nodes, ${this.graph.edges.length} edges`);
  }

  /** Export graph as JSON serializable object */
  toJSON(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: Array.from(this.graph.nodes.values()),
      edges: this.graph.edges,
    };
  }

  /** Clear the graph */
  clear(): void {
    this.graph = { nodes: new Map(), edges: [] };
  }

  /** Get node count */
  get nodeCount(): number {
    return this.graph.nodes.size;
  }

  /** Get edge count */
  get edgeCount(): number {
    return this.graph.edges.length;
  }

  /** Get graph as Mermaid.js flowchart */
  toMermaid(): string {
    const lines: string[] = ["graph LR;"];
    
    for (const [id, node] of this.graph.nodes) {
      const label = node.name.replace(/[^a-zA-Z0-9_\-]/g, "_");
      const shape = node.type === "file" ? "[" : node.type === "test" ? "{(" : "(";
      const closeShape = node.type === "file" ? "]" : node.type === "test" ? ")}" : ")";
      lines.push(`  ${label}${shape}${node.name}${closeShape};`);
    }

    for (const edge of this.graph.edges) {
      const sourceLabel = this.graph.nodes.get(edge.source)?.name.replace(/[^a-zA-Z0-9_\-]/g, "_") || edge.source;
      const targetLabel = this.graph.nodes.get(edge.target)?.name.replace(/[^a-zA-Z0-9_\-]/g, "_") || edge.target;
      lines.push(`  ${sourceLabel} -->|${edge.type}| ${targetLabel};`);
    }

    return lines.join("\n");
  }

  private generateSuggestions(complexity: ImpactAnalysis["changeComplexity"], fileCount: number): string[] {
    const suggestions: string[] = [];
    if (complexity === "high") {
      suggestions.push("Consider breaking this change into smaller, incremental steps");
      suggestions.push("Ensure all downstream consumers are updated");
    }
    suggestions.push("Run the test suite after making changes");
    suggestions.push("Review all impacted files before committing");
    return suggestions;
  }
}

let _graph: KnowledgeGraphBuilder | null = null;

export function getKnowledgeGraph(): KnowledgeGraphBuilder {
  _graph ||= new KnowledgeGraphBuilder();
  return _graph;
}
