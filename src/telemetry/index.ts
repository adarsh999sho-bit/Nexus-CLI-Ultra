import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getLogger } from "../shared/logger";

interface TelemetryEvent {
  event: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

export class Telemetry {
  private enabled: boolean;
  private events: TelemetryEvent[] = [];
  private configPath: string;
  private log = getLogger();

  constructor(configDir: string) {
    this.configPath = join(configDir, "telemetry.json");
    this.enabled = this.loadPreference();
  }

  /** Enable telemetry */
  enable(): void {
    this.enabled = true;
    this.savePreference();
    this.log.info("Telemetry enabled (opt-in)");
  }

  /** Disable telemetry */
  disable(): void {
    this.enabled = false;
    this.savePreference();
    this.log.info("Telemetry disabled");
  }

  /** Check if telemetry is enabled */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Track an event (only if enabled) */
  track(event: string, properties: Record<string, unknown> = {}): void {
    if (!this.enabled) return;

    const telemetryEvent: TelemetryEvent = {
      event,
      properties: this.sanitize(properties),
      timestamp: new Date().toISOString(),
    };

    this.events.push(telemetryEvent);

    // Flush if we have enough events
    if (this.events.length >= 10) {
      this.flush();
    }
  }

  /** Flush events to storage */
  flush(): void {
    if (this.events.length === 0 || !this.enabled) return;

    try {
      const existing = this.loadEvents();
      const allEvents = [...existing, ...this.events];
      writeFileSync(this.configPath, JSON.stringify(allEvents, null, 2));
      this.events = [];
    } catch (err) {
      this.log.warn("Failed to flush telemetry", { error: String(err) });
    }
  }

  /** Get stored events count */
  getEventCount(): number {
    try {
      return this.loadEvents().length;
    } catch {
      return 0;
    }
  }

  /** Clear all stored events */
  clear(): void {
    this.events = [];
    try {
      writeFileSync(this.configPath, "[]");
    } catch { /* ignore */ }
  }

  /** Track a command execution */
  trackCommand(command: string, durationMs: number, success: boolean): void {
    this.track("command_executed", {
      command,
      durationMs,
      success,
      timestamp: new Date().toISOString(),
    });
  }

  /** Track a provider call */
  trackProviderCall(provider: string, model: string, success: boolean): void {
    this.track("provider_call", {
      provider,
      model,
      success,
    });
  }

  /** Sanitize properties to remove sensitive data */
  private sanitize(properties: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ["api_key", "apiKey", "password", "secret", "token", "key"];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(properties)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private loadPreference(): boolean {
    try {
      if (existsSync(this.configPath)) {
        const data = JSON.parse(readFileSync(this.configPath, "utf-8"));
        return data.enabled === true;
      }
    } catch { /* ignore */ }
    return false;
  }

  private savePreference(): void {
    try {
      const dir = join(this.configPath, "..");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.configPath, JSON.stringify({ enabled: this.enabled }, null, 2));
    } catch { /* ignore */ }
  }

  private loadEvents(): TelemetryEvent[] {
    try {
      if (existsSync(this.configPath)) {
        const data = JSON.parse(readFileSync(this.configPath, "utf-8"));
        return Array.isArray(data) ? data : [];
      }
    } catch { /* ignore */ }
    return [];
  }
}
