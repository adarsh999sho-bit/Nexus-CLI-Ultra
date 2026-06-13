import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { existsSync } from "node:fs";
import type { FileEntry, FileCategory } from "./types";
import { getLogger } from "../shared/logger";

const IGNORED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "target", ".next",
  ".nuxt", ".cache", ".vite", "coverage", ".nyc_output",
  ".svelte-kit", ".expo", ".turbo", ".vercel", ".serverless",
  "__pycache__", ".venv", "vendor", ".bundle",
]);

const IGNORED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".ico", ".svg", ".webp",
  ".mp4", ".mp3", ".wav", ".ogg",
  ".ttf", ".woff", ".woff2", ".eot",
  ".zip", ".tar", ".gz", ".rar",
  ".exe", ".dll", ".so", ".dylib",
  ".map", ".min.js", ".min.css",
]);

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescript-react", ".js": "javascript",
  ".jsx": "javascript-react", ".mjs": "javascript", ".cjs": "javascript",
  ".py": "python", ".rs": "rust", ".go": "go", ".java": "java",
  ".rb": "ruby", ".php": "php", ".c": "c", ".cpp": "cpp", ".h": "c",
  ".hpp": "cpp", ".cs": "csharp", ".swift": "swift", ".kt": "kotlin",
  ".scala": "scala", ".zig": "zig",
  ".json": "json", ".yaml": "yaml", ".yml": "yaml", ".toml": "toml",
  ".xml": "xml", ".md": "markdown", ".mdx": "markdown",
  ".html": "html", ".css": "css", ".scss": "scss", ".less": "less",
  ".sql": "sql", ".graphql": "graphql", ".gql": "graphql",
  ".sh": "shell", ".bash": "shell", ".zsh": "shell",
  ".dockerfile": "docker", ".Dockerfile": "docker",
  ".env": "env", ".gitignore": "gitignore",
};

const CONFIG_EXTENSIONS = new Set([".json", ".yaml", ".yml", ".toml", ".env", ".gitignore"]);
const DOCS_EXTENSIONS = new Set([".md", ".mdx", ".txt"]);

const TEST_SUFFIXES = [
  ".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx",
  ".test.js", ".spec.js", ".test.py",
  "_test.go", "_test.rs",
];

export class RepositoryScanner {
  private log = getLogger();
  private ignoredPatterns: string[] = [];

  constructor() {
    this.loadGitignore();
  }

  private loadGitignore(): void {
    try {
      const gitignorePath = join(process.cwd(), ".gitignore");
      if (existsSync(gitignorePath)) {
        const content = readFileSync(gitignorePath, "utf-8");
        this.ignoredPatterns = content
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("#") && !l.startsWith("!"));
      }
    } catch {
      // No .gitignore
    }
  }

  /** Scan a directory and return all files */
  scan(dir: string = process.cwd(), maxFiles: number = 1000): FileEntry[] {
    const results: FileEntry[] = [];
    this.scanRecursive(dir, dir, results, maxFiles);
    this.log.debug(`Scanned ${results.length} files in ${dir}`);
    return results;
  }

  private scanRecursive(
    root: string,
    dir: string,
    results: FileEntry[],
    maxFiles: number,
  ): void {
    if (results.length >= maxFiles) return;

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      const fullPath = join(dir, entry);
      const relPath = relative(root, fullPath);

      if (this.isIgnored(relPath)) continue;

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          if (IGNORED_DIRS.has(entry)) continue;
          this.scanRecursive(root, fullPath, results, maxFiles);
        } else if (stat.isFile()) {
          const ext = extname(entry).toLowerCase();
          if (IGNORED_EXTENSIONS.has(ext)) continue;

          const category = this.determineCategory(entry, ext);
          const language = EXTENSION_LANGUAGE_MAP[ext] || "unknown";

          results.push({
            path: relPath,
            category: language === "unknown" ? "unknown" : category,
            language,
            size: stat.size,
            lines: 0,
            lastModified: stat.mtime,
            isIgnored: false,
          });
        }
      } catch {
        // Permission errors, skip
      }
    }
  }

  /** Determine file category based on name and extension */
  private determineCategory(entry: string, ext: string): FileCategory {
    // Check test suffixes first
    for (const suffix of TEST_SUFFIXES) {
      if (entry.endsWith(suffix)) return "test";
    }

    // Check config files
    if (CONFIG_EXTENSIONS.has(ext)) return "config";

    // Check docs
    if (DOCS_EXTENSIONS.has(ext)) return "docs";

    // Check code (must have a known language mapping)
    if (EXTENSION_LANGUAGE_MAP[ext]) return "code";

    return "unknown";
  }

  /** Get file content */
  readFile(filePath: string): string | null {
    try {
      return readFileSync(join(process.cwd(), filePath), "utf-8");
    } catch {
      return null;
    }
  }

  /** Classify a single file (public API) */
  classifyFile(filePath: string): FileCategory {
    return this.determineCategory(filePath, extname(filePath).toLowerCase());
  }

  private isIgnored(relPath: string): boolean {
    for (const pattern of this.ignoredPatterns) {
      if (relPath.startsWith(pattern) || relPath.includes(`/${pattern}/`)) {
        return true;
      }
    }
    return false;
  }
}
