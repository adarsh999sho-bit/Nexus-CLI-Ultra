import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { RollbackAction } from "./types";
import { getLogger } from "../shared/logger";

export class RollbackManager {
  private log = getLogger();
  private actions: RollbackAction[] = [];
  private snapshotsDir: string;

  constructor(snapshotsDir: string) {
    this.snapshotsDir = snapshotsDir;
    this.ensureDir();
  }

  /** Save a file snapshot before modification */
  snapshotFile(filePath: string): void {
    try {
      const fullPath = join(process.cwd(), filePath);
      if (!existsSync(fullPath)) return;

      const content = readFileSync(fullPath, "utf-8");
      const snapshotPath = this.getSnapshotPath(filePath);
      writeFileSync(snapshotPath, content);

      this.actions.push({
        type: "file_restore",
        description: `Snapshot of ${filePath}`,
        file: filePath,
        originalContent: content,
        timestamp: new Date(),
      });

      this.log.debug(`File snapshot saved: ${filePath}`);
    } catch (err) {
      this.log.warn(`Failed to snapshot file ${filePath}`, { error: String(err) });
    }
  }

  /** Save a git command for potential reversion */
  recordGitCommand(command: string, description: string): void {
    this.actions.push({
      type: "git_revert",
      description,
      gitCommand: command,
      timestamp: new Date(),
    });
  }

  /** Restore a file from its snapshot */
  restoreFile(filePath: string, originalContent: string): boolean {
    try {
      const fullPath = join(process.cwd(), filePath);
      writeFileSync(fullPath, originalContent);
      this.log.info(`File restored: ${filePath}`);
      return true;
    } catch (err) {
      this.log.error(`Failed to restore file ${filePath}`, { error: String(err) });
      return false;
    }
  }

  /** Rollback all actions in reverse order */
  async rollbackAll(): Promise<{ success: boolean; message: string }> {
    const reversed = [...this.actions].reverse();
    let successCount = 0;
    let failCount = 0;

    for (const action of reversed) {
      try {
        if (action.type === "file_restore" && action.file && action.originalContent) {
          const restored = this.restoreFile(action.file, action.originalContent);
          if (restored) successCount++;
          else failCount++;
        } else if (action.type === "git_revert" && action.gitCommand) {
          // Execute git revert
          const result = this.runGit(action.gitCommand);
          if (result) successCount++;
          else failCount++;
        }
      } catch (err) {
        failCount++;
        this.log.error(`Rollback action failed: ${action.description}`, { error: String(err) });
      }
    }

    this.actions = [];
    return {
      success: failCount === 0,
      message: `Rollback: ${successCount} succeeded, ${failCount} failed`,
    };
  }

  /** Rollback to a specific checkpoint */
  rollbackTo(checkpointActions: RollbackAction[]): Promise<{ success: boolean; message: string }> {
    this.actions = [...checkpointActions];
    return this.rollbackAll();
  }

  /** Get all recorded actions */
  getActions(): RollbackAction[] {
    return [...this.actions];
  }

  /** Clear action history */
  clear(): void {
    this.actions = [];
  }

  private getSnapshotPath(filePath: string): string {
    const safe = filePath.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
    return join(this.snapshotsDir, `${safe}.snapshot`);
  }

  private runGit(command: string): boolean {
    try {
      const process = Bun.spawnSync(["git", ...command.split(" ")]);
      return process.exitCode === 0;
    } catch {
      return false;
    }
  }

  private ensureDir(): void {
    if (!existsSync(this.snapshotsDir)) {
      mkdirSync(this.snapshotsDir, { recursive: true });
    }
  }
}
