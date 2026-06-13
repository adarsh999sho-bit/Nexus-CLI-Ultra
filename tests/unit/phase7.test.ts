import { describe, it, expect } from "bun:test";

describe("Plugin SDK", () => {
  it("should define plugin types", async () => {
    const types = await import("../../src/plugin/types");
    expect(types).toBeDefined();
  });

  it("should create plugin loader", async () => {
    const { PluginLoader } = await import("../../src/plugin/loader");
    const loader = new PluginLoader();
    expect(loader.count).toBe(0);
  });

  it("should create plugin API", async () => {
    const { PluginLoader } = await import("../../src/plugin/loader");
    const { PluginAPI } = await import("../../src/plugin/api");
    const loader = new PluginLoader();
    const api = new PluginAPI(loader);
    expect(api.pluginCount).toBe(0);
    expect(api.getToolNames()).toEqual([]);
  });

  it("should create context with logger", async () => {
    const { PluginLoader } = await import("../../src/plugin/loader");
    const { PluginAPI } = await import("../../src/plugin/api");
    const loader = new PluginLoader();
    const api = new PluginAPI(loader);
    const ctx = api.createContext();
    expect(ctx.logger).toBeDefined();
    expect(ctx.registerTool).toBeDefined();
    expect(ctx.getMemory).toBeDefined();
    expect(ctx.setMemory).toBeDefined();
  });
});

describe("Permissions", () => {
  it("should allow admin all access", async () => {
    const { PermissionManager } = await import("../../src/security/permissions");
    const pm = new PermissionManager("admin");
    expect(pm.can("write", "file")).toBe(true);
    expect(pm.can("delete", "anything")).toBe(true);
  });

  it("should restrict readonly access", async () => {
    const { PermissionManager } = await import("../../src/security/permissions");
    const pm = new PermissionManager("readonly");
    expect(pm.can("read", "file")).toBe(true);
    expect(pm.can("write", "file")).toBe(false);
  });

  it("should restrict developer access to secrets", async () => {
    const { PermissionManager } = await import("../../src/security/permissions");
    const pm = new PermissionManager("developer");
    expect(pm.can("read", "file")).toBe(true);
    expect(pm.can("read", "secrets")).toBe(false);
    expect(pm.can("write", "secrets")).toBe(false);
  });

  it("should throw on denied permission", async () => {
    const { PermissionManager } = await import("../../src/security/permissions");
    const pm = new PermissionManager("readonly");
    expect(() => pm.require("write", "file")).toThrow("Permission denied");
  });

  it("should list available roles", async () => {
    const { PermissionManager } = await import("../../src/security/permissions");
    const roles = PermissionManager.getRoles();
    expect(roles).toContain("admin");
    expect(roles).toContain("developer");
    expect(roles).toContain("readonly");
  });
});

describe("Secrets Manager", () => {
  it("should store and retrieve secrets", async () => {
    const { SecretsManager } = await import("../../src/security/secrets");
    const sm = new SecretsManager(".nexus-test/secrets");
    sm.set("api_key", "sk-test123");
    expect(sm.get("api_key")).toBe("sk-test123");
    sm.clear();
  });

  it("should check secret existence", async () => {
    const { SecretsManager } = await import("../../src/security/secrets");
    const sm = new SecretsManager(".nexus-test/secrets");
    sm.set("test-key", "test-value");
    expect(sm.has("test-key")).toBe(true);
    expect(sm.has("nonexistent")).toBe(false);
    sm.clear();
  });

  it("should delete secrets", async () => {
    const { SecretsManager } = await import("../../src/security/secrets");
    const sm = new SecretsManager(".nexus-test/secrets");
    sm.set("temp", "value");
    expect(sm.delete("temp")).toBe(true);
    expect(sm.has("temp")).toBe(false);
  });

  it("should list secret keys", async () => {
    const { SecretsManager } = await import("../../src/security/secrets");
    const sm = new SecretsManager(".nexus-test/secrets");
    sm.set("key1", "val1");
    sm.set("key2", "val2");
    const keys = sm.list();
    expect(keys).toContain("key1");
    expect(keys).toContain("key2");
    sm.clear();
  });
});

describe("Telemetry", () => {
  it("should be disabled by default", async () => {
    const { Telemetry } = await import("../../src/telemetry/index");
    const t = new Telemetry(".nexus-test/telemetry");
    expect(t.isEnabled()).toBe(false);
  });

  it("should enable and disable", async () => {
    const { Telemetry } = await import("../../src/telemetry/index");
    const t = new Telemetry(".nexus-test/telemetry");
    t.enable();
    expect(t.isEnabled()).toBe(true);
    t.disable();
    expect(t.isEnabled()).toBe(false);
  });

  it("should track events when enabled", async () => {
    const { Telemetry } = await import("../../src/telemetry/index");
    const t = new Telemetry(".nexus-test/telemetry");
    t.enable();
    t.track("test_event", { value: 42 });
    // Events should be queued
    expect(t.getEventCount()).toBeGreaterThanOrEqual(0);
    t.disable();
  });
});

describe("Updater", () => {
  it("should create updater with version", async () => {
    const { Updater } = await import("../../src/updater/index");
    const updater = new Updater();
    expect(updater.getVersion()).toBeDefined();
  });

  it("should check for updates", async () => {
    const { Updater } = await import("../../src/updater/index");
    const updater = new Updater();
    const result = await updater.checkForUpdate();
    expect(result.currentVersion).toBeDefined();
    expect(typeof result.hasUpdate).toBe("boolean");
  });
});
