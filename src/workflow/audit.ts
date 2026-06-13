import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { AuditEntry } from "./types";
import { getLogger } from "../shared/logger";

export class AuditTrail {
  private entries: AuditEntry[] = [];
  private auditDir: string;
  private log = getLogger();

  constructor(auditDir: string) {
    this.auditDir = auditDir;
    this.ensureDir();
  }

  /** Record an action in the audit trail */
  record(entry: Omit<AuditEntry, "id" | "timestamp">): AuditEntry {
    const auditEntry: AuditEntry = {
      ...entry,
      id: randomUUID(),
      timestamp: new Date(),
    };

    this.entries.push(auditEntry);
    this.log.debug(`Audit: ${entry.agent} - ${entry.action}`);

    return auditEntry;
  }

  /** Get all entries for a workflow */
  getWorkflowEntries(workflowId: string): AuditEntry[] {
    return this.entries.filter((e) => e.workflowId === workflowId);
  }

  /** Get the most recent N entries */
  getRecent(count: number = 10): AuditEntry[] {
    return this.entries.slice(-count);
  }

  /** Generate a summary report from audit entries */
  generateReport(workflowId: string): string {
    const wfEntries = this.getWorkflowEntries(workflowId);
    if (wfEntries.length === 0) return "No audit entries found.";

    const successCount = wfEntries.filter((e) => e.success).length;
    const failCount = wfEntries.filter((e) => !e.success).length;
    const totalDuration = wfEntries.reduce((sum, e) => sum + e.durationMs, 0);

    const lines: string[] = [
      `# Audit Report: ${workflowId}`,
      "",
      `Total Actions: ${wfEntries.length}`,
      `Successful: ${successCount}`,
      `Failed: ${failCount}`,
      `Total Duration: ${(totalDuration / 1000).toFixed(2)}s`,
      "",
      "## Action Log",
      "",
    ];

    for (const entry of wfEntries) {
      const status = entry.success ? "✅" : "❌";
      const time = entry.timestamp.toISOString().slice(11, 19);
      lines.push(`${status} [${time}] ${entry.agent}: ${entry.action} (${entry.durationMs}ms)`);
    }

    lines.push("", "## Failed Actions", "");
    for (const entry of wfEntries.filter((e) => !e.success)) {
      lines.push(`- ${entry.agent}: ${entry.action}`);
      lines.push(`  Input: ${JSON.stringify(entry.input)}`);
      lines.push(`  Output: ${JSON.stringify(entry.output)}`);
      lines.push("");
    }

    return lines.join("\n");
  }

  /** Save audit trail to a file */
  saveToFile(workflowId: string): string {
    const filePath = join(this.auditDir, `${workflowId}-audit.json`);
    writeFileSync(filePath, JSON.stringify(this.entries, null, 2));
    this.log.debug(`Audit trail saved: ${filePath}`);
    return filePath;
  }

  /** Export audit as JSON */
  toJSON(): AuditEntry[] {
    return [...this.entries];
  }

  /** Clear all entries */
  clear(): void {
    this.entries = [];
  }

  /** Get entry count */
  get count(): number {
    return this.entries.length;
  }

  private ensureDir(): void {
    if (!existsSync(this.auditDir)) {
      mkdirSync(this.auditDir, { recursive: true });
    }
  }
}
