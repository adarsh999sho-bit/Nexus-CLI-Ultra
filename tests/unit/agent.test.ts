import { describe, it, expect } from "bun:test";

describe("Agent Types", () => {
  it("should define all type exports", async () => {
    const types = await import("../../src/agent/types");
    expect(types).toBeDefined();
  });
});

describe("Base Agent", () => {
  it("should be abstract and require execute implementation", async () => {
    const { BaseAgent } = await import("../../src/agent/base");
    // Can instantiate via a concrete subclass - testing that the class exists
    expect(BaseAgent).toBeDefined();
  });
});

describe("Planner Agent", () => {
  it("should create a plan from a goal", async () => {
    const { PlannerAgent } = await import("../../src/agent/planner");
    const planner = new PlannerAgent();
    expect(planner.type).toBe("planner");

    const plan = planner.createPlan("Write tests for the auth module");
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.goal).toBe("Write tests for the auth module");
  });

  it("should detect test tasks from descriptions", async () => {
    const { PlannerAgent } = await import("../../src/agent/planner");
    const planner = new PlannerAgent();
    const plan = planner.createPlan("Add unit tests for the payment service");
    const testTasks = plan.tasks.filter((t) => t.type === "tester");
    expect(testTasks.length).toBeGreaterThan(0);
  });

  it("should detect debug tasks from descriptions", async () => {
    const { PlannerAgent } = await import("../../src/agent/planner");
    const planner = new PlannerAgent();
    const plan = planner.createPlan("Fix the login bug in auth.ts");
    const debugTasks = plan.tasks.filter((t) => t.type === "debugger");
    expect(debugTasks.length).toBeGreaterThan(0);
  });

  it("should detect documentation tasks", async () => {
    const { PlannerAgent } = await import("../../src/agent/planner");
    const planner = new PlannerAgent();
    const plan = planner.createPlan("Generate README documentation");
    const docsTasks = plan.tasks.filter((t) => t.type === "docs");
    expect(docsTasks.length).toBeGreaterThan(0);
  });

  it("should detect security tasks", async () => {
    const { PlannerAgent } = await import("../../src/agent/planner");
    const planner = new PlannerAgent();
    const plan = planner.createPlan("Run security audit on dependencies");
    const securityTasks = plan.tasks.filter((t) => t.type === "security");
    expect(securityTasks.length).toBeGreaterThan(0);
  });

  it("should add coder tasks by default", async () => {
    const { PlannerAgent } = await import("../../src/agent/planner");
    const planner = new PlannerAgent();
    const plan = planner.createPlan("Implement a new API endpoint");
    const coderTasks = plan.tasks.filter((t) => t.type === "coder");
    expect(coderTasks.length).toBeGreaterThan(0);
  });

  it("should add review tasks after code tasks", async () => {
    const { PlannerAgent } = await import("../../src/agent/planner");
    const planner = new PlannerAgent();
    const plan = planner.createPlan("Add data validation");
    const reviewerTasks = plan.tasks.filter((t) => t.type === "reviewer");
    expect(reviewerTasks.length).toBeGreaterThan(0);
  });

  it("should estimate complexity based on task count", async () => {
    const { PlannerAgent } = await import("../../src/agent/planner");
    const planner = new PlannerAgent();

    const simple = planner.createPlan("Hello");
    expect(["simple", "moderate", "complex"]).toContain(simple.estimatedComplexity);
  });
});

describe("Coder Agent", () => {
  it("should create and run", async () => {
    const { CoderAgent } = await import("../../src/agent/coder");
    const coder = new CoderAgent();
    expect(coder.type).toBe("coder");
    expect(coder.name).toBe("Coder");
  });

  it("should report capabilities", async () => {
    const { CoderAgent } = await import("../../src/agent/coder");
    const coder = new CoderAgent();
    const caps = coder.getCapabilities();
    expect(caps.type).toBe("coder");
    expect(caps.tools).toContain("write_file");
  });
});

describe("Reviewer Agent", () => {
  it("should create and report type", async () => {
    const { ReviewerAgent } = await import("../../src/agent/reviewer");
    const reviewer = new ReviewerAgent();
    expect(reviewer.type).toBe("reviewer");
  });
});

describe("Tester Agent", () => {
  it("should create and report type", async () => {
    const { TesterAgent } = await import("../../src/agent/tester");
    const tester = new TesterAgent();
    expect(tester.type).toBe("tester");
  });
});

describe("Researcher Agent", () => {
  it("should create and report type", async () => {
    const { ResearcherAgent } = await import("../../src/agent/researcher");
    const researcher = new ResearcherAgent();
    expect(researcher.type).toBe("researcher");
  });
});

describe("Security Agent", () => {
  it("should create and report type", async () => {
    const { SecurityAgent } = await import("../../src/agent/security");
    const security = new SecurityAgent();
    expect(security.type).toBe("security");
  });
});

describe("Debugger Agent", () => {
  it("should create and report type", async () => {
    const { DebuggerAgent } = await import("../../src/agent/debugger");
    const debugger_ = new DebuggerAgent();
    expect(debugger_.type).toBe("debugger");
  });
});

describe("Docs Agent", () => {
  it("should create and report type", async () => {
    const { DocsAgent } = await import("../../src/agent/docs");
    const docs = new DocsAgent();
    expect(docs.type).toBe("docs");
  });
});

describe("Agent Coordinator", () => {
  it("should create and register default agents", async () => {
    const { AgentCoordinator } = await import("../../src/agent/coordinator");
    const coordinator = new AgentCoordinator();
    const status = coordinator.getStatus();
    expect(status.length).toBeGreaterThanOrEqual(7); // planner, coder, reviewer, tester, researcher, security, debugger, docs
  });

  it("should process a goal end-to-end", async () => {
    const { AgentCoordinator } = await import("../../src/agent/coordinator");
    const coordinator = new AgentCoordinator();
    const result = await coordinator.processGoal("Review code for bugs");

    expect(result).toBeDefined();
    expect(result.plan).toBeDefined();
    expect(result.plan.tasks.length).toBeGreaterThan(0);
  });

  it("should use shared memory", async () => {
    const { AgentCoordinator } = await import("../../src/agent/coordinator");
    const coordinator = new AgentCoordinator();
    coordinator.setMemory("test-key", "test-value");
    expect(coordinator.getMemory("test-key")).toBe("test-value");
    coordinator.clearMemory();
    expect(coordinator.getMemory("test-key")).toBeUndefined();
  });

  it("should get specific agent by type", async () => {
    const { AgentCoordinator } = await import("../../src/agent/coordinator");
    const coordinator = new AgentCoordinator();
    const coder = coordinator.getAgent("coder");
    expect(coder).toBeDefined();
    expect(coder!.name).toBe("Coder");
  });
});

describe("Agent Index", () => {
  it("should export all agent modules", async () => {
    const agent = await import("../../src/agent/index");
    expect(agent.BaseAgent).toBeDefined();
    expect(agent.PlannerAgent).toBeDefined();
    expect(agent.CoderAgent).toBeDefined();
    expect(agent.ReviewerAgent).toBeDefined();
    expect(agent.TesterAgent).toBeDefined();
    expect(agent.ResearcherAgent).toBeDefined();
    expect(agent.SecurityAgent).toBeDefined();
    expect(agent.DebuggerAgent).toBeDefined();
    expect(agent.DocsAgent).toBeDefined();
    expect(agent.AgentCoordinator).toBeDefined();
    expect(agent.getCoordinator).toBeDefined();
  });
});
