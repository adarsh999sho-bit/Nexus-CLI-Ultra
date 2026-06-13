/** A node in the knowledge graph */
export interface GraphNode {
  id: string;
  type: "file" | "symbol" | "module" | "api" | "database" | "route" | "test";
  name: string;
  file?: string;
  line?: number;
  metadata: Record<string, unknown>;
}

/** An edge connecting two nodes in the knowledge graph */
export interface GraphEdge {
  source: string;
  target: string;
  type: "imports" | "calls" | "extends" | "implements" | "defines" | "references" | "tests" | "documents";
  weight: number;
}

/** The complete knowledge graph */
export interface KnowledgeGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
}

/** A dependency between files or modules */
export interface Dependency {
  source: string;
  target: string;
  type: "internal" | "external";
  importPath: string;
}

/** Dependency analysis result */
export interface DependencyAnalysis {
  files: number;
  externalDependencies: Map<string, number>;
  circularDependencies: string[][];
  dependencyGraph: Dependency[];
}

/** Architecture diagram output */
export interface ArchitectureDiagram {
  type: "system" | "api" | "erd" | "dependency" | "microservices";
  title: string;
  mermaid: string;
  description: string;
}

/** Impact analysis result */
export interface ImpactAnalysis {
  symbol: string;
  impactedFiles: string[];
  impactedTests: string[];
  changeComplexity: "low" | "medium" | "high";
  suggestions: string[];
}

/** Database schema inference */
export interface DatabaseSchema {
  tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string; nullable: boolean; primaryKey: boolean; foreignKey?: string }>;
    rowCount?: number;
  }>;
  relationships: Array<{
    from: string;
    fromColumn: string;
    to: string;
    toColumn: string;
  }>;
}
