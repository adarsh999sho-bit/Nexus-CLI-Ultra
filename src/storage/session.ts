import { randomUUID } from "node:crypto";
import { getDatabase } from "./sqlite";
import { getLogger } from "../shared/logger";
import type { Session, Message } from "../shared/types";

interface SessionRow {
  id: string;
  name: string;
  messages: string;
  created_at: string;
  updated_at: string;
  metadata: string;
}

export class SessionManager {
  private log = getLogger();

  /** Create a new session */
  create(name: string = "New Session"): Session {
    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();
    const session: Session = {
      id,
      name,
      messages: [],
      createdAt: new Date(now),
      updatedAt: new Date(now),
      metadata: {},
    };

    db.execute(
      `INSERT INTO sessions (id, name, messages, created_at, updated_at, metadata)
       VALUES ($id, $name, $messages, $created_at, $updated_at, $metadata)`,
      {
        $id: id,
        $name: name,
        $messages: JSON.stringify([]),
        $created_at: now,
        $updated_at: now,
        $metadata: JSON.stringify({}),
      },
    );

    this.log.debug(`Session created: ${id}`);
    return session;
  }

  /** Load a session by ID */
  get(id: string): Session | null {
    const db = getDatabase();
    const row = db.queryOne<SessionRow>(
      "SELECT * FROM sessions WHERE id = $id",
      { $id: id },
    );
    return row ? this.rowToSession(row) : null;
  }

  /** List all sessions */
  list(limit: number = 20): Session[] {
    const db = getDatabase();
    const rows = db.query<SessionRow>(
      "SELECT * FROM sessions ORDER BY updated_at DESC LIMIT $limit",
      { $limit: String(limit) },
    );
    return rows.map((r) => this.rowToSession(r));
  }

  /** Update session messages */
  updateMessages(id: string, messages: Message[]): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.execute(
      `UPDATE sessions SET messages = $messages, updated_at = $updated_at WHERE id = $id`,
      {
        $id: id,
        $messages: JSON.stringify(messages),
        $updated_at: now,
      },
    );
  }

  /** Update session metadata */
  updateMetadata(id: string, metadata: Record<string, unknown>): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    const existing = this.get(id);
    const merged = { ...(existing?.metadata || {}), ...metadata };

    db.execute(
      `UPDATE sessions SET metadata = $metadata, updated_at = $updated_at WHERE id = $id`,
      {
        $id: id,
        $metadata: JSON.stringify(merged),
        $updated_at: now,
      },
    );
  }

  /** Rename a session */
  rename(id: string, name: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.execute(
      `UPDATE sessions SET name = $name, updated_at = $updated_at WHERE id = $id`,
      { $id: id, $name: name, $updated_at: now },
    );
  }

  /** Delete a session */
  delete(id: string): void {
    const db = getDatabase();
    db.execute("DELETE FROM sessions WHERE id = $id", { $id: id });
    this.log.debug(`Session deleted: ${id}`);
  }

  /** Add a message to a session */
  addMessage(sessionId: string, message: Message): void {
    const session = this.get(sessionId);
    if (!session) return;
    session.messages.push(message);
    this.updateMessages(sessionId, session.messages);
  }

  /** Clear messages in a session */
  clearMessages(sessionId: string): void {
    this.updateMessages(sessionId, []);
  }

  /** Get active session (most recently updated) */
  getActive(): Session | null {
    const sessions = this.list(1);
    return sessions[0] || null;
  }

  private rowToSession(row: SessionRow): Session {
    return {
      id: row.id,
      name: row.name,
      messages: JSON.parse(row.messages || "[]"),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      metadata: JSON.parse(row.metadata || "{}"),
    };
  }
}

let _sessionManager: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  _sessionManager ||= new SessionManager();
  return _sessionManager;
}
