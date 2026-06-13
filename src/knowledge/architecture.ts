import type { ArchitectureDiagram } from "./types";
import { getLogger } from "../shared/logger";

export class ArchitectureGenerator {
  private log = getLogger();

  /** Generate a system architecture diagram */
  generateSystemDiagram(
    modules: Array<{ name: string; description: string; dependencies: string[] }>,
  ): ArchitectureDiagram {
    const lines: string[] = ["graph TB;"];
    const moduleIds = new Map<string, string>();

    // Add module nodes
    for (const mod of modules) {
      const id = this.safeId(mod.name);
      moduleIds.set(mod.name, id);
      lines.push(`  ${id}[${mod.name}]`);
    }

    // Add dependency edges
    for (const mod of modules) {
      const sourceId = moduleIds.get(mod.name);
      if (!sourceId) continue;
      for (const dep of mod.dependencies) {
        const targetId = moduleIds.get(dep);
        if (targetId) {
          lines.push(`  ${sourceId} --> ${targetId}`);
        }
      }
    }

    return {
      type: "system",
      title: "System Architecture",
      mermaid: lines.join("\n"),
      description: `System architecture with ${modules.length} modules`,
    };
  }

  /** Generate an API flow diagram */
  generateApiDiagram(
    routes: Array<{ method: string; path: string; handler: string; middleware?: string[] }>,
  ): ArchitectureDiagram {
    const lines: string[] = ["graph LR;"];
    lines.push("  Client[Client]");

    for (const route of routes) {
      const id = this.safeId(`${route.method} ${route.path}`);
      lines.push(`  ${id}["${route.method} ${route.path}"]`);
      lines.push(`  Client --> ${id}`);

      if (route.middleware) {
        for (const mw of route.middleware) {
          const mwId = this.safeId(mw);
          lines.push(`  ${id} --> ${mwId}[${mw}]`);
        }
      }
    }

    return {
      type: "api",
      title: "API Routes",
      mermaid: lines.join("\n"),
      description: `${routes.length} API routes`,
    };
  }

  /** Generate a dependency graph diagram */
  generateDependencyDiagram(
    deps: Array<{ source: string; target: string; type: string }>,
  ): ArchitectureDiagram {
    const lines: string[] = ["graph LR;"];
    const added = new Set<string>();

    for (const dep of deps) {
      const sourceId = this.safeId(dep.source);
      const targetId = this.safeId(dep.target);

      if (!added.has(dep.source)) {
        lines.push(`  ${sourceId}[${dep.source}]`);
        added.add(dep.source);
      }
      if (!added.has(dep.target)) {
        lines.push(`  ${targetId}[${dep.target}]`);
        added.add(dep.target);
      }

      lines.push(`  ${sourceId} -->|${dep.type}| ${targetId}`);
    }

    return {
      type: "dependency",
      title: "Dependency Graph",
      mermaid: lines.join("\n"),
      description: `${deps.length} dependency relationships`,
    };
  }

  /** Export as Mermaid file content */
  toMermaidFile(diagrams: ArchitectureDiagram[]): string {
    const parts: string[] = [];
    for (const diag of diagrams) {
      parts.push(`---\ntitle: ${diag.title}\n---`);
      parts.push(diag.mermaid);
      parts.push("");
    }
    return parts.join("\n");
  }

  /** Generate all diagrams for a project analysis */
  generateAllDiagrams(
    modules: Array<{ name: string; description: string; dependencies: string[] }>,
    routes: Array<{ method: string; path: string; handler: string; middleware?: string[] }>,
    deps: Array<{ source: string; target: string; type: string }>,
  ): ArchitectureDiagram[] {
    return [
      this.generateSystemDiagram(modules),
      this.generateApiDiagram(routes),
      this.generateDependencyDiagram(deps),
    ];
  }

  private safeId(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      || "node";
  }
}
