import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Checkpoint } from "./types";
import { getLogger } from "../shared/logger";

export class CheckpointManager {
  private checkpointsDir: string;
  private log = getLogger();

  constructor(checkpointsDir: string) {
    this.checkpointsDir = checkpointsDir;
    this.ensureDir(this.checkpointsDir);
  }

  /** Save a checkpoint */
  save(
    workflowId: string,
    data: {
      completedTasks: string[];
      taskResults: Record<string, unknown>;
      memory: Record<string, unknown>;
    },
  ): Checkpoint {
    const checkpoint: Checkpoint = {
      id: randomUUID(),
      workflowId,
      timestamp: new Date(),
      completedTasks: data.completedTasks,
      taskResults: data.taskResults,
      memory: data.memory,
    };

    const workflowDir = join(this.checkpointsDir, workflowId);
    this.ensureDir(workflowDir);

    const filePath = this.getPath(workflowId, checkpoint.id);
    writeFileSync(filePath, JSON.stringify(checkpoint, null, 2));
    this.log.debug(`Checkpoint saved: ${checkpoint.id}`);

    return checkpoint;
  }

  /** Load a specific checkpoint */
  load(workflowId: string, checkpointId: string): Checkpoint | null {
    try {
      const filePath = this.getPath(workflowId, checkpointId);
      if (!existsSync(filePath)) return null;
      return JSON.parse(readFileSync(filePath, "utf-8")) as Checkpoint;
    } catch (err) {
      this.log.warn(`Failed to load checkpoint ${checkpointId}`, { error: String(err) });
      return null;
    }
  }

  /** Get the latest checkpoint for a workflow */
  getLatest(workflowId: string): Checkpoint | null {
    try {
      const dir = join(this.checkpointsDir, workflowId);
      if (!existsSync(dir)) return null;

      const files = readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse();

      if (files.length === 0) return null;
      return this.load(workflowId, files[0].replace(".json", ""));
    } catch {
      return null;
    }
  }

  /** List all checkpoints for a workflow */
  list(workflowId: string): Checkpoint[] {
    try {
      const dir = join(this.checkpointsDir, workflowId);
      if (!existsSync(dir)) return [];

      return readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => this.load(workflowId, f.replace(".json", "")))
        .filter(Boolean) as Checkpoint[];
    } catch {
      return [];
    }
  }

  /** Delete old checkpoints, keeping only the most recent N */
  prune(workflowId: string, keepCount: number = 5): void {
    const checkpoints = this.list(workflowId);
    if (checkpoints.length <= keepCount) return;

    const toDelete = checkpoints.slice(0, checkpoints.length - keepCount);
    for (const cp of toDelete) {
      try {
        const filePath = this.getPath(workflowId, cp.id);
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
      } catch {
        // Ignore
      }
    }
  }

  private getPath(workflowId: string, checkpointId: string): string {
    return join(this.checkpointsDir, workflowId, `${checkpointId}.json`);
  }

  private ensureDir(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
