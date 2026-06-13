import { describe, it, expect } from "bun:test";

describe("Workflow Types", () => {
  it("should define all type exports", async () => {
    const types = await import("../../src/workflow/types");
    expect(types).toBeDefined();
  });
});

describe("Checkpoint Manager", () => {
  it("should save and load checkpoints", async () => {
    const { CheckpointManager } = await import("../../src/workflow/checkpoint");
    const manager = new CheckpointManager(".nexus-test/checkpoints");

    const saved = manager.save("test-workflow", {
      completedTasks: ["task-1"],
      taskResults: { "task-1": { success: true } },
      memory: { key: "value" },
    });

    expect(saved.workflowId).toBe("test-workflow");
    expect(saved.completedTasks).toContain("task-1");

    const loaded = manager.load("test-workflow", saved.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(saved.id);
  });

  it("should list checkpoints for a workflow", async () => {
    const { CheckpointManager } = await import("../../src/workflow/checkpoint");
    const manager = new CheckpointManager(".nexus-test/checkpoints");

    manager.save("list-workflow", { completedTasks: ["t1"], taskResults: {}, memory: {} });
    manager.save("list-workflow", { completedTasks: ["t1", "t2"], taskResults: {}, memory: {} });

    const list = manager.list("list-workflow");
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it("should get the latest checkpoint", async () => {
    const { CheckpointManager } = await import("../../src/workflow/checkpoint");
    const manager = new CheckpointManager(".nexus-test/checkpoints");

    manager.save("latest-workflow", { completedTasks: ["old"], taskResults: {}, memory: {} });
    const latest = manager.save("latest-workflow", { completedTasks: ["new"], taskResults: {}, memory: {} });

    const loaded = manager.getLatest("latest-workflow");
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(latest.id);
  });
});

describe("Audit Trail", () => {
  it("should record and retrieve entries", async () => {
    const { AuditTrail } = await import("../../src/workflow/audit");
    const audit = new AuditTrail(".nexus-test/audit");

    audit.record({
      workflowId: "wf-1",
      agent: "coder",
      action: "edit_file",
      input: { file: "test.ts" },
      output: { success: true },
      success: true,
      durationMs: 100,
    });

    expect(audit.count).toBe(1);

    const entries = audit.getWorkflowEntries("wf-1");
    expect(entries.length).toBe(1);
    expect(entries[0].agent).toBe("coder");
  });

  it("should generate reports", async () => {
    const { AuditTrail } = await import("../../src/workflow/audit");
    const audit = new AuditTrail(".nexus-test/audit");

    audit.record({ workflowId: "wf-2", agent: "planner", action: "created_plan", input: {}, output: {}, success: true, durationMs: 50 });

    const report = audit.generateReport("wf-2");
    expect(report).toContain("Audit Report");
    expect(report).toContain("planner");
  });

  it("should clear entries", async () => {
    const { AuditTrail } = await import("../../src/workflow/audit");
    const audit = new AuditTrail(".nexus-test/audit");
    audit.record({ workflowId: "wf-3", agent: "test", action: "test", input: {}, output: {}, success: true, durationMs: 10 });
    audit.clear();
    expect(audit.count).toBe(0);
  });
});

describe("Workflow Engine", () => {
  it("should create with default config", async () => {
    const { WorkflowEngine } = await import("../../src/workflow/engine");
    const engine = new WorkflowEngine();
    expect(engine.getConfig().maxIterations).toBe(10);
    expect(engine.getConfig().approvalGates.length).toBe(4);
  });

  it("should accept custom config", async () => {
    const { WorkflowEngine } = await import("../../src/workflow/engine");
    const engine = new WorkflowEngine({ maxIterations: 5 });
    expect(engine.getConfig().maxIterations).toBe(5);
  });

  it("should execute a workflow end-to-end", async () => {
    const { WorkflowEngine } = await import("../../src/workflow/engine");
    const engine = new WorkflowEngine({ maxIterations: 3 });

    const result = await engine.execute("Review code quality");
    expect(result).toBeDefined();
    expect(result.workflowId).toBeDefined();
    expect(typeof result.success).toBe("boolean");
  });

  it("should track status", async () => {
    const { WorkflowEngine } = await import("../../src/workflow/engine");
    const engine = new WorkflowEngine();
    expect(engine.getStatus()).toBe("running");
    await engine.execute("Simple task");
    expect(["completed", "failed"]).toContain(engine.getStatus());
  });

  it("should return audit trail", async () => {
    const { WorkflowEngine } = await import("../../src/workflow/engine");
    const engine = new WorkflowEngine();
    const audit = engine.getAudit();
    expect(audit).toBeDefined();
    expect(audit.count).toBeGreaterThanOrEqual(0);
  });
});

describe("Workflow Index", () => {
  it("should export all workflow modules", async () => {
    const wf = await import("../../src/workflow/index");
    expect(wf.CheckpointManager).toBeDefined();
    expect(wf.AuditTrail).toBeDefined();
    expect(wf.WorkflowEngine).toBeDefined();
    expect(wf.getWorkflowEngine).toBeDefined();
  });
});
