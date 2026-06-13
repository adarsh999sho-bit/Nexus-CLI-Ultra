import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join } from "node:path";

/** Get the Nexus config directory */
export function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "nexus");
  return join(homedir(), ".config", "nexus");
}

/** Get the Nexus data directory */
export function getDataDir(): string {
  const xdg = process.env.XDG_DATA_HOME;
  if (xdg) return join(xdg, "nexus");
  return join(homedir(), ".local", "share", "nexus");
}

/** Find a nexus.json config file starting from cwd, going up */
export function findProjectConfig(startDir: string = process.cwd()): string | null {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, "nexus.json");
    if (existsSync(candidate)) return candidate;
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Get system info string */
export function getSystemInfo(): string {
  return `${process.platform}/${process.arch} - Bun ${Bun.version} - ${hostname()}`;
}

/** Truncate a string to a max length */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/** Format a timestamp for display */
export function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Check if a directory is a git repo */
export function isGitRepo(dir: string = process.cwd()): boolean {
  return existsSync(join(dir, ".git"));
}

/** Get current git branch */
export function getGitBranch(dir: string = process.cwd()): string | null {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { cwd: dir, encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

/** Ensure a directory exists */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    Bun.spawnSync(["mkdir", "-p", dir]);
  }
}

/** Format byte size to human readable */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Deep merge two objects */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const val = source[key];
    if (val !== undefined) {
      if (isPlainObject(val) && isPlainObject(result[key])) {
        result[key] = deepMerge(result[key] as Record<string, unknown>, val as Record<string, unknown>) as T[keyof T];
      } else {
        result[key] = val as T[keyof T];
      }
    }
  }
  return result;
}

function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === "object" && obj !== null && !Array.isArray(obj);
}
