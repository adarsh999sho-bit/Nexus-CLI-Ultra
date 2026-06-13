import { getLogger } from "../shared/logger";
import type { AgentType, Task, TaskResult, WorkflowPlan, ApprovalRequest } from "./types";
import { BaseAgent } from "./base";
import { PlannerAgent } from "./planner";
import { CoderAgent } from "./coder";
import { ReviewerAgent } from "./reviewer";
import { TesterAgent } from "./tester";
import { ResearcherAgent } from "./researcher";
import { SecurityAgent } from "./security";
import { DebuggerAgent } from "./debugger";
import { DocsAgent } from "./docs";

export class AgentCoordinator {
  private agents: Map<AgentType, BaseAgent> = new Map();
  private tasks: Map<string, Task> = new Map();
  private results: Map<string, TaskResult> = new Map();
  private sharedMemory: Map<string, unknown> = new Map();
  private log = getLogger();

  constructor() {
    this.registerDefaultAgents();
  }

  /** Register all default agents */
  private registerDefaultAgents(): void {
    this.register(new PlannerAgent());
    this.register(new CoderAgent());
    this.register(new ReviewerAgent());
    this.register(new TesterAgent());
    this.register(new ResearcherAgent());
    this.register(new SecurityAgent());
    this.register(new DebuggerAgent());
    this.register(new DocsAgent());
  }

  /** Register a single agent */
  register(agent: BaseAgent): void {
    this.agents.set(agent.type, agent);
    this.log.debug(`Agent registered: ${agent.name} (${agent.type})`);
  }

  /** Get a registered agent by type */
  getAgent(type: AgentType): BaseAgent | undefined {
    return this.agents.get(type);
  }

  /** Process a high-level goal through the multi-agent pipeline */
  async processGoal(goal: string): Promise<{
    success: boolean;
    plan: WorkflowPlan;
    results: Map<string, TaskResult>;
    summary: string;
  }> {
    this.log.info(`Processing goal: ${goal}`);

    // 1. Get planner
    const planner = this.getAgent("planner") as PlannerAgent;
    if (!planner) {
      throw new Error("Planner agent not registered");
    }

    // 2. Create plan
    const plan = planner.createPlan(goal);
    this.log.info(`Created plan with ${plan.tasks.length} tasks`);

    // 3. Execute tasks respecting dependencies
    const results = await this.executePlan(plan);

    // 4. Generate summary
    const successCount = Array.from(results.values()).filter((r) => r.success).length;
    const summary = `Completed ${successCount}/${plan.tasks.length} tasks successfully`;

    return { success: successCount === plan.tasks.length, plan, results, summary };
  }

  /** Execute a workflow plan with dependency-aware task scheduling */
  private async executePlan(plan: WorkflowPlan): Promise<Map<string, TaskResult>> {
    const { tasks } = plan;
    const completed = new Set<string>();
    const running = new Set<string>();
    const results = new Map<string, TaskResult>();

    // Store tasks
    for (const task of tasks) {
      this.tasks.set(task.id, task);
    }

    // Execute until all tasks are done or failed
    while (completed.size + running.size < tasks.length) {
      const readyTasks = tasks.filter(
        (t) =>
          t.status === "pending" &&
          t.dependencies.every((depId) => completed.has(depId)),
      );

      if (readyTasks.length === 0 && running.size === 0) {
        break; // No progress possible - likely a dependency cycle
      }

      // Execute ready tasks (simplified: sequential for now)
      for (const task of readyTasks) {
        running.add(task.id);
        task.status = "running";

        const agent = this.agents.get(task.type);
        if (!agent) {
          task.status = "failed";
          results.set(task.id, {
            success: false,
            summary: `No agent found for type: ${task.type}`,
            output: "",
          });
          continue;
        }

        try {
          const agentResult = await agent.run({
            task,
            conversation: [],
            projectFiles: [],
            availableModels: [],
            memory: Object.fromEntries(this.sharedMemory),
          });

          results.set(task.id, agentResult.result);
          task.result = agentResult.result;
          task.status = agentResult.success ? "completed" : "failed";

          // Store in shared memory
          if (agentResult.result.metadata) {
            for (const [key, val] of Object.entries(agentResult.result.metadata)) {
              this.sharedMemory.set(`agent:${task.type}:${key}`, val);
            }
          }
        } catch (err) {
          task.status = "failed";
          results.set(task.id, {
            success: false,
            summary: String(err),
            output: String(err),
          });
        }

        running.delete(task.id);
        completed.add(task.id);
      }
    }

    return results;
  }

  /** Get a value from shared memory */
  getMemory(key: string): unknown {
    return this.sharedMemory.get(key);
  }

  /** Set a value in shared memory */
  setMemory(key: string, value: unknown): void {
    this.sharedMemory.set(key, value);
  }

  /** Clear all shared memory */
  clearMemory(): void {
    this.sharedMemory.clear();
  }

  /** Get a list of all task results */
  getResults(): Map<string, TaskResult> {
    return new Map(this.results);
  }

  /** Get human-readable status of all agents */
  getStatus(): Array<{ type: AgentType; name: string; registered: boolean }> {
    return Array.from(this.agents.entries()).map(([type, agent]) => ({
      type,
      name: agent.name,
      registered: true,
    }));
  }
}

let _coordinator: AgentCoordinator | null = null;

export function getCoordinator(): AgentCoordinator {
  _coordinator ||= new AgentCoordinator();
  return _coordinator;
}
