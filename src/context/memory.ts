import type { MemoryEntry, MemoryLevel } from "./types";
import { getLogger } from "../shared/logger";
import { getDatabase } from "../storage/sqlite";

export class MemoryManager {
  private log = getLogger();
  private workingMemory: Map<string, string> = new Map();

  /** Store a fact in working memory (volatile, current task) */
  setWorking(key: string, value: string): void {
    this.workingMemory.set(key, value);
  }

  /** Get a fact from working memory */
  getWorking(key: string): string | undefined {
    return this.workingMemory.get(key);
  }

  /** Clear working memory */
  clearWorking(): void {
    this.workingMemory.clear();
  }

  /** Store a fact in session memory (persistent in SQLite) */
  setSession(key: string, value: string): void {
    try {
      const db = getDatabase();
      db.execute(
        `INSERT OR REPLACE INTO memory (id, type, content, metadata, created_at, updated_at)
         VALUES ($id, $type, $content, $metadata, datetime('now'), datetime('now'))`,
        { $id: `session:${key}`, $type: "session", $content: value, $metadata: JSON.stringify({ key }) },
      );
    } catch (err) {
      this.log.warn("Failed to store session memory", { error: String(err) });
    }
  }

  /** Get a fact from session memory */
  getSession(key: string): string | null {
    try {
      const db = getDatabase();
      const row = db.queryOne<{ content: string }>(
        "SELECT content FROM memory WHERE id = $id",
        { $id: `session:${key}` },
      );
      return row?.content || null;
    } catch {
      return null;
    }
  }

  /** Store a persistent fact about the repository */
  setRepository(key: string, value: string): void {
    try {
      const db = getDatabase();
      db.execute(
        `INSERT OR REPLACE INTO memory (id, type, content, metadata, created_at, updated_at)
         VALUES ($id, $type, $content, $metadata, datetime('now'), datetime('now'))`,
        { $id: `repo:${key}`, $type: "repository", $content: value, $metadata: JSON.stringify({ key }) },
      );
    } catch (err) {
      this.log.warn("Failed to store repository memory", { error: String(err) });
    }
  }

  /** Get repository memory */
  getRepository(key: string): string | null {
    try {
      const db = getDatabase();
      const row = db.queryOne<{ content: string }>(
        "SELECT content FROM memory WHERE id = $id",
        { $id: `repo:${key}` },
      );
      return row?.content || null;
    } catch {
      return null;
    }
  }

  /** Get all repository memory entries */
  getAllRepository(): Array<{ key: string; value: string }> {
    try {
      const db = getDatabase();
      const rows = db.query<{ id: string; content: string }>(
        "SELECT id, content FROM memory WHERE type = 'repository' ORDER BY updated_at DESC LIMIT 50",
      );
      return rows.map((r) => ({ key: r.id.replace("repo:", ""), value: r.content }));
    } catch {
      return [];
    }
  }

  /** Store user preference */
  setUserPreference(key: string, value: string): void {
    try {
      const db = getDatabase();
      db.execute(
        `INSERT OR REPLACE INTO memory (id, type, content, metadata, created_at, updated_at)
         VALUES ($id, $type, $content, $metadata, datetime('now'), datetime('now'))`,
        { $id: `user:${key}`, $type: "user", $content: value, $metadata: JSON.stringify({ key }) },
      );
    } catch (err) {
      this.log.warn("Failed to store user preference", { error: String(err) });
    }
  }

  /** Get user preference */
  getUserPreference(key: string): string | null {
    try {
      const db = getDatabase();
      const row = db.queryOne<{ content: string }>(
        "SELECT content FROM memory WHERE id = $id",
        { $id: `user:${key}` },
      );
      return row?.content || null;
    } catch {
      return null;
    }
  }

  /** Get all session memories as context string */
  getSessionContext(): string {
    try {
      const db = getDatabase();
      const rows = db.query<{ content: string }>(
        "SELECT content FROM memory WHERE type = 'session' ORDER BY updated_at DESC LIMIT 20",
      );
      return rows.map((r) => r.content).join("\n");
    } catch {
      return "";
    }
  }

  /** Get all repository memories as context string */
  getRepositoryContext(): string {
    const entries = this.getAllRepository();
    return entries.map((e) => `[Known] ${e.key}: ${e.value}`).join("\n");
  }

  /** Delete old entries to prevent bloat */
  prune(maxEntries: number = 100): void {
    try {
      const db = getDatabase();
      db.execute(
        `DELETE FROM memory WHERE id NOT IN (
          SELECT id FROM memory ORDER BY updated_at DESC LIMIT $limit
        )`,
        { $limit: String(maxEntries) },
      );
    } catch {
      // Ignore
    }
  }

  /** Clear all memory */
  clearAll(): void {
    try {
      const db = getDatabase();
      db.execute("DELETE FROM memory");
      this.workingMemory.clear();
    } catch {
      // Ignore
    }
  }
}

let _memoryManager: MemoryManager | null = null;

export function getMemoryManager(): MemoryManager {
  _memoryManager ||= new MemoryManager();
  return _memoryManager;
}
