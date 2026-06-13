import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getLogger } from "../shared/logger";

export class SecretsManager {
  private secrets: Map<string, string> = new Map();
  private secretsPath: string;
  private log = getLogger();

  constructor(secretsDir: string) {
    this.secretsPath = join(secretsDir, "secrets.json");
    this.ensureDir(secretsDir);
    this.load();
  }

  /** Set a secret value */
  set(key: string, value: string): void {
    this.secrets.set(key, value);
    this.save();
    this.log.debug(`Secret set: ${key}`);
  }

  /** Get a secret value */
  get(key: string): string | undefined {
    return this.secrets.get(key) || process.env[`NEXUS_SECRET_${key.toUpperCase()}`];
  }

  /** Delete a secret */
  delete(key: string): boolean {
    const removed = this.secrets.delete(key);
    if (removed) {
      this.save();
      this.log.debug(`Secret deleted: ${key}`);
    }
    return removed;
  }

  /** Check if a secret exists */
  has(key: string): boolean {
    return this.secrets.has(key) || !!process.env[`NEXUS_SECRET_${key.toUpperCase()}`];
  }

  /** List all secret keys (not values) */
  list(): string[] {
    return Array.from(this.secrets.keys());
  }

  /** Clear all secrets */
  clear(): void {
    this.secrets.clear();
    this.save();
    this.log.debug("All secrets cleared");
  }

  /** Load secrets from file */
  private load(): void {
    try {
      if (existsSync(this.secretsPath)) {
        const data = JSON.parse(readFileSync(this.secretsPath, "utf-8"));
        for (const [key, value] of Object.entries(data)) {
          this.secrets.set(key, value as string);
        }
      }
    } catch (err) {
      this.log.warn("Failed to load secrets", { error: String(err) });
    }
  }

  /** Save secrets to file (base64 encoded for basic obfuscation) */
  private save(): void {
    try {
      const obj: Record<string, string> = {};
      for (const [key, value] of this.secrets) {
        obj[key] = Buffer.from(value).toString("base64");
      }
      writeFileSync(this.secretsPath, JSON.stringify(obj, null, 2));
    } catch (err) {
      this.log.error("Failed to save secrets", { error: String(err) });
    }
  }

  /** Decode a stored secret */
  private decode(encoded: string): string {
    try {
      return Buffer.from(encoded, "base64").toString("utf-8");
    } catch {
      return encoded;
    }
  }

  private ensureDir(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
