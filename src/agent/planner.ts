import { BaseAgent } from "./base";
import type { AgentContext, TaskResult, AgentCapabilities, WorkflowPlan, Task } from "./types";
import { randomUUID } from "node:crypto";

export class PlannerAgent extends BaseAgent {
  constructor() {
    super("planner", "Planner");
  }

  getCapabilities(): AgentCapabilities {
    return {
      type: "planner",
      description: "Decomposes complex tasks into a directed acyclic graph of subtasks",
      tools: ["analyze", "decompose"],
      requiresModel: true,
      maxTokens: 4000,
    };
  }

  protected async execute(context: AgentContext): Promise<TaskResult> {
    const { task } = context;
    const goal = task.description;

    // Decompose the goal into subtasks based on keywords and patterns
    const subTasks = this.decompose(goal, task.id);

    return this.success(
      `Created plan with ${subTasks.length} subtasks`,
      JSON.stringify({ goal, tasks: subTasks }, null, 2),
      { metadata: { plan: { goal, tasks: subTasks } } },
    );
  }

  /** Decompose a goal into subtasks */
  private decompose(goal: string, parentId: string): Task[] {
    const tasks: Task[] = [];
    const lowercase = goal.toLowerCase();

    // Detect task types from the description
    if (lowercase.includes("test") || lowercase.includes("spec")) {
      tasks.push(this.makeTask("tester", `Write tests for: ${goal}`, parentId, []));
    }
    if (lowercase.includes("review") || lowercase.includes("check")) {
      tasks.push(this.makeTask("reviewer", `Review code changes for: ${goal}`, parentId, []));
    }
    if (lowercase.includes("fix") || lowercase.includes("bug") || lowercase.includes("error") || lowercase.includes("debug")) {
      tasks.push(this.makeTask("debugger", `Debug and fix: ${goal}`, parentId, []));
    }
    if (lowercase.includes("document") || lowercase.includes("doc") || lowercase.includes("readme")) {
      tasks.push(this.makeTask("docs", `Generate documentation for: ${goal}`, parentId, []));
    }
    if (lowercase.includes("security") || lowercase.includes("vulnerable") || lowercase.includes("audit")) {
      tasks.push(this.makeTask("security", `Security audit for: ${goal}`, parentId, []));
    }
    if (lowercase.includes("search") || lowercase.includes("find") || lowercase.includes("research") || lowercase.includes("how")) {
      tasks.push(this.makeTask("researcher", `Research: ${goal}`, parentId, []));
    }

    // Default: add a coder task
    if (tasks.length === 0 || lowercase.includes("write") || lowercase.includes("create") || lowercase.includes("implement") || lowercase.includes("add") || lowercase.includes("refactor")) {
      const coderDeps = tasks.filter((t) => t.type !== "coder").map((t) => t.id);
      tasks.push(this.makeTask("coder", `Implement: ${goal}`, parentId, coderDeps));
    }

    // Add a review step at the end for any code changes
    const codeTasks = tasks.filter((t) => t.type === "coder" || t.type === "debugger");
    if (codeTasks.length > 0) {
      tasks.push(this.makeTask("reviewer", `Review all changes for: ${goal}`, parentId, codeTasks.map((t) => t.id)));
    }

    return tasks;
  }

  private makeTask(type: Task["type"], description: string, parentId: string, dependencies: string[]): Task {
    return {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description,
      type,
      status: "pending",
      dependencies,
      context: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /** Create a full workflow plan */
  createPlan(goal: string): WorkflowPlan {
    const tasks = this.decompose(goal, "plan");
    const deps = new Map<string, string[]>();
    for (const t of tasks) {
      deps.set(t.id, t.dependencies);
    }

    return {
      id: randomUUID(),
      goal,
      tasks,
      dependencies: deps,
      estimatedComplexity: tasks.length <= 3 ? "simple" : tasks.length <= 6 ? "moderate" : "complex",
    };
  }
}
