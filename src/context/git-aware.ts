import { getLogger } from "../shared/logger";
import type { ContextPiece } from "./types";

export interface GitDiff {
  file: string;
  added: number;
  removed: number;
  hunks: Array<{ oldStart: number; newStart: number; content: string }>;
  isStaged: boolean;
}

export interface GitBlame {
  file: string;
  line: number;
  author: string;
  date: string;
  commit: string;
  summary: string;
}

export class GitContext {
  private log = getLogger();

  /** Get unstaged diff */
  getUnstagedDiff(): GitDiff[] {
    return this.execGitDiff("diff", false);
  }

  /** Get staged diff */
  getStagedDiff(): GitDiff[] {
    return this.execGitDiff("diff --cached", true);
  }

  /** Get combined diff (staged + unstaged) */
  getAllDiffs(): GitDiff[] {
    return [...this.getStagedDiff(), ...this.getUnstagedDiff()];
  }

  /** Get recent commits */
  getRecentCommits(count: number = 5): Array<{ hash: string; message: string; author: string; date: string }> {
    try {
      const output = this.runGit(`log --oneline --format="%h||%s||%an||%ar" -${count}`);
      if (!output) return [];

      return output.trim().split("\n").filter(Boolean).map((line) => {
        const [hash, message, author, date] = line.split("||");
        return { hash, message, author, date };
      });
    } catch {
      return [];
    }
  }

  /** Get current branch name */
  getCurrentBranch(): string | null {
    try {
      return this.runGit("rev-parse --abbrev-ref HEAD")?.trim() || null;
    } catch {
      return null;
    }
  }

  /** Get blame for a file */
  getBlame(file: string): GitBlame[] {
    try {
      const output = this.runGit(`blame --line-porcelain "${file}"`);
      if (!output) return [];

      const blame: GitBlame[] = [];
      const lines = output.split("\n");
      let author = "";
      let date = "";
      let commit = "";
      let summary = "";
      let lineNum = 0;

      for (const line of lines) {
        if (line.startsWith("author ")) author = line.slice(7);
        else if (line.startsWith("author-time ")) date = new Date(Number(line.slice(12)) * 1000).toISOString();
        else if (line.startsWith("summary ")) summary = line.slice(8);
        else if (line.match(/^[a-f0-9]+\s+\d+/)) {
          const parts = line.split(/\s+/);
          commit = parts[0];
          lineNum = Number(parts[1]);
          blame.push({ file, line: lineNum, author, date, commit, summary });
        }
      }

      return blame;
    } catch {
      return [];
    }
  }

  /** Convert git diffs to context pieces */
  diffsToContext(diffs: GitDiff[]): ContextPiece[] {
    return diffs.map((diff) => ({
      type: "diff" as const,
      source: diff.file,
      content: `[${diff.isStaged ? "STAGED" : "UNSTAGED"}] ${diff.file}\n+${diff.added} -${diff.removed}\n${diff.hunks.map((h) => h.content).join("\n")}`,
      relevance: {
        semantic: 0.7,
        keyword: 0.5,
        recency: 1.0,
        priority: 0.8,
      },
      tokenCount: Math.ceil(diff.hunks.reduce((sum, h) => sum + h.content.length, 0) / 4),
    }));
  }

  /** Get a summary of the git state */
  getGitSummary(): string {
    const branch = this.getCurrentBranch();
    const commits = this.getRecentCommits(3);
    const diffs = this.getAllDiffs();

    const parts: string[] = [];
    if (branch) parts.push(`Branch: ${branch}`);
    if (commits.length > 0) {
      parts.push("Recent commits:");
      for (const c of commits) {
        parts.push(`  ${c.hash} ${c.message} (${c.author}, ${c.date})`);
      }
    }
    if (diffs.length > 0) {
      parts.push(`${diffs.length} modified file(s)`);
    }

    return parts.join("\n");
  }

  /** Check if we're in a git repo */
  isGitRepo(): boolean {
    try {
      const result = this.runGit("rev-parse --git-dir");
      return !!result?.trim();
    } catch {
      return false;
    }
  }

  private execGitDiff(command: string, isStaged: boolean): GitDiff[] {
    try {
      const output = this.runGit(`${command} --unified=5`);
      if (!output) return [];

      return this.parseDiff(output, isStaged);
    } catch {
      return [];
    }
  }

  private parseDiff(output: string, isStaged: boolean): GitDiff[] {
    const diffs: GitDiff[] = [];
    const fileBlocks = output.split("\ndiff --git ").filter(Boolean);

    for (const block of fileBlocks) {
      const lines = block.split("\n");
      const fileMatch = lines[0]?.match(/a\/(.+)\s+b\/(.+)/);
      if (!fileMatch) continue;

      const file = fileMatch[2];
      const hunks: Array<{ oldStart: number; newStart: number; content: string }> = [];
      let currentHunk: { oldStart: number; newStart: number; content: string[] } | null = null;
      let added = 0;
      let removed = 0;

      for (const line of lines.slice(1)) {
        const hunkMatch = line.match(/^@@ -(\d+),\d+ \+(\d+),\d+ @@/);
        if (hunkMatch) {
          if (currentHunk) {
            hunks.push({ oldStart: currentHunk.oldStart, newStart: currentHunk.newStart, content: currentHunk.content.join("\n") });
          }
          currentHunk = { oldStart: Number(hunkMatch[1]), newStart: Number(hunkMatch[2]), content: [] };
        } else if (currentHunk) {
          currentHunk.content.push(line);
          if (line.startsWith("+")) added++;
          else if (line.startsWith("-")) removed++;
        }
      }

      if (currentHunk) {
        hunks.push({ oldStart: currentHunk.oldStart, newStart: currentHunk.newStart, content: currentHunk.content.join("\n") });
      }

      diffs.push({ file, added, removed, hunks, isStaged });
    }

    return diffs;
  }

  private runGit(args: string): string | null {
    try {
      const process = Bun.spawnSync(["git", ...args.split(" ")]);
      if (process.exitCode !== 0) return null;
      return new TextDecoder().decode(process.stdout);
    } catch {
      return null;
    }
  }
}
