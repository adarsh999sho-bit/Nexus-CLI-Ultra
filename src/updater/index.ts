import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getLogger } from "../shared/logger";

interface UpdateInfo {
  latestVersion: string;
  currentVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  hasUpdate: boolean;
}

export class Updater {
  private currentVersion: string;
  private log = getLogger();
  private updateUrl: string;

  constructor(updateUrl?: string) {
    this.currentVersion = this.loadVersion();
    this.updateUrl = updateUrl || "https://api.github.com/repos/nexus-cli-ultra/nexus-cli-ultra/releases/latest";
  }

  /** Check for updates */
  async checkForUpdate(): Promise<UpdateInfo> {
    try {
      const response = await fetch(this.updateUrl, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return this.noUpdate("Could not check for updates");
      }

      const data = (await response.json()) as { tag_name?: string; html_url?: string; body?: string };
      const latestVersion = (data.tag_name || "0.0.0").replace(/^v/, "");

      return {
        latestVersion,
        currentVersion: this.currentVersion,
        downloadUrl: data.html_url || "",
        releaseNotes: data.body || "",
        hasUpdate: this.compareVersions(latestVersion, this.currentVersion) > 0,
      };
    } catch (err) {
      this.log.warn("Update check failed", { error: String(err) });
      return this.noUpdate(String(err));
    }
  }

  /** Apply an update */
  async applyUpdate(downloadUrl: string): Promise<boolean> {
    try {
      this.log.info(`Downloading update from ${downloadUrl}`);

      // In a real implementation, this would download and extract the binary
      // For now, we provide instructions
      this.log.info("To update manually: npm install -g nexus-cli-ultra");
      return false;
    } catch (err) {
      this.log.error("Update failed", { error: String(err) });
      return false;
    }
  }

  /** Get current version */
  getVersion(): string {
    return this.currentVersion;
  }

  private loadVersion(): string {
    try {
      const pkgPath = join(process.cwd(), "package.json");
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        return pkg.version || "0.1.0";
      }
    } catch { /* ignore */ }
    return "0.1.0";
  }

  private noUpdate(reason: string): UpdateInfo {
    return {
      latestVersion: this.currentVersion,
      currentVersion: this.currentVersion,
      downloadUrl: "",
      releaseNotes: reason,
      hasUpdate: false,
    };
  }

  private compareVersions(a: string, b: string): number {
    const partsA = a.split(".").map(Number);
    const partsB = b.split(".").map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;
      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }
    return 0;
  }
}
