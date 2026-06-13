import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { getLogger } from "../shared/logger";
import type { Dependency, DependencyAnalysis } from "./types";

export class DependencyAnalyzer {
  private log = getLogger();

  /** Analyze dependencies in all files */
  analyze(files: string[], workspaceDir: string = process.cwd()): DependencyAnalysis {
    const dependencies: Dependency[] = [];
    const externalDeps = new Map<string, number>();
    const circularDeps: string[][] = [];

    // Map imports for each file
    const importMap = new Map<string, string[]>();

    for (const file of files) {
      try {
        const content = readFileSync(join(workspaceDir, file), "utf-8");
        const imports = this.extractImports(content);

        importMap.set(file, imports);

        for (const imp of imports) {
          // Categorize as internal or external
          if (imp.startsWith(".") || imp.startsWith("/")) {
            const resolved = this.resolveInternalImport(file, imp);
            dependencies.push({
              source: file,
              target: resolved || imp,
              type: "internal",
              importPath: imp,
            });
          } else {
            const pkgName = imp.split("/")[0].startsWith("@")
              ? `${imp.split("/")[0]}/${imp.split("/")[1]}`
              : imp.split("/")[0];
            externalDeps.set(pkgName, (externalDeps.get(pkgName) || 0) + 1);
            dependencies.push({
              source: file,
              target: pkgName,
              type: "external",
              importPath: imp,
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Detect circular dependencies
    circularDeps.push(...this.findCircularDependencies(importMap));

    this.log.debug(
      `Dependency analysis: ${dependencies.length} deps, ${externalDeps.size} external packages, ${circularDeps.length} circular chains`,
    );

    return {
      files: files.length,
      externalDependencies: externalDeps,
      circularDependencies: circularDeps,
      dependencyGraph: dependencies,
    };
  }

  /** Extract import statements from source code */
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      // ES import
      const importMatch = line.match(/import\s+(?:\w+\s*,?\s*)?(?:\{[^}]*\})?\s*from\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        imports.push(importMatch[1]);
        continue;
      }

      // Dynamic import
      const dynamicImport = line.match(/import\(['"]([^'"]+)['"]\)/);
      if (dynamicImport) {
        imports.push(dynamicImport[1]);
        continue;
      }

      // Require
      const requireMatch = line.match(/(?:const|let|var)\s+\w+\s*=\s*require\(['"]([^'"]+)['"]\)/);
      if (requireMatch) {
        imports.push(requireMatch[1]);
      }
    }

    return imports;
  }

  /** Resolve a relative import to an absolute path */
  private resolveInternalImport(file: string, importPath: string): string | null {
    try {
      const dir = join(process.cwd(), file, "..");
      const resolved = join(dir, importPath);
      const rel = relative(process.cwd(), resolved).replace(/\\/g, "/");
      // Remove extension if no extension specified
      return rel.match(/\.\w+$/) ? rel : `${rel}.ts`;
    } catch {
      return null;
    }
  }

  /** Find circular dependencies using DFS */
  private findCircularDependencies(importMap: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const inPath = new Set<string>();
    const path: string[] = [];

    const dfs = (file: string) => {
      if (inPath.has(file)) {
        // Found a cycle
        const cycleStart = path.indexOf(file);
        const cycle = path.slice(cycleStart).concat(file);
        cycles.push(cycle);
        return;
      }
      if (visited.has(file)) return;

      visited.add(file);
      inPath.add(file);
      path.push(file);

      const imports = importMap.get(file) || [];
      for (const imp of imports) {
        if (imp.startsWith(".")) {
          const resolved = this.resolveInternalImport(file, imp);
          if (resolved && importMap.has(resolved)) {
            dfs(resolved);
          }
        }
      }

      path.pop();
      inPath.delete(file);
    };

    for (const file of importMap.keys()) {
      dfs(file);
    }

    // Deduplicate cycles
    const unique = new Map<string, string[]>();
    for (const cycle of cycles) {
      const key = [...cycle].sort().join("->");
      if (!unique.has(key)) {
        unique.set(key, cycle);
      }
    }

    return Array.from(unique.values());
  }

  /** Get a summary string of external dependencies */
  getExternalDepsSummary(deps: DependencyAnalysis): string {
    const lines: string[] = ["## External Dependencies\n"];
    const sorted = Array.from(deps.externalDependencies.entries())
      .sort((a, b) => b[1] - a[1]);

    for (const [pkg, count] of sorted) {
      lines.push(`- ${pkg} (used in ${count} files)`);
    }

    if (deps.circularDependencies.length > 0) {
      lines.push("\n## ⚠️ Circular Dependencies\n");
      for (const cycle of deps.circularDependencies) {
        lines.push(`- ${cycle.join(" → ")}`);
      }
    }

    return lines.join("\n");
  }
}
