import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getLogger } from "../shared/logger";
import { homedir } from "node:os";

export class DatabaseManager {
  private db: Database;
  private log = getLogger();
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.ensureDir();
    this.db = new Database(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.migrate();
    this.log.debug(`Database opened: ${dbPath}`);
  }

  private ensureDir(): void {
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        messages TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        metadata TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memory (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_memory_type ON memory(type);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at);
    `);
    this.log.debug("Database migrations applied");
  }

  getDb(): Database {
    return this.db;
  }

  close(): void {
    this.db.close();
    this.log.debug("Database closed");
  }

  /** Execute a query and return rows */
  query<T>(sql: string, params?: Record<string, string>): T[] {
    const stmt = this.db.query(sql);
    if (params) {
      return stmt.all(params as import("bun:sqlite").SQLQueryBindings) as T[];
    }
    return stmt.all() as T[];
  }

  /** Execute a query and return a single row */
  queryOne<T>(sql: string, params?: Record<string, string>): T | null {
    const stmt = this.db.query(sql);
    const result = params
      ? stmt.get(params as import("bun:sqlite").SQLQueryBindings)
      : stmt.get();
    return (result || null) as T | null;
  }

  /** Execute a statement */
  execute(sql: string, params?: Record<string, string | number | boolean | null>): void {
    const stmt = this.db.query(sql);
    if (params) {
      stmt.run(params as import("bun:sqlite").SQLQueryBindings);
    } else {
      stmt.run();
    }
  }
}

let _db: DatabaseManager | null = null;

export function getDatabase(dbPath?: string): DatabaseManager {
  if (!_db) {
    if (!dbPath) {
      dbPath = process.env.NEXUS_DB_PATH || `${homedir()}/.config/nexus/nexus.db`;
    }
    _db = new DatabaseManager(dbPath);
  }
  return _db;
}

export function closeDatabase(): void {
  _db?.close();
  _db = null;
}
