import { getLogger } from "../shared/logger";
import type {
  AgentType,
  AgentContext,
  AgentRunResult,
  AgentCapabilities,
  TaskResult,
  Task,
} from "./types";
import { randomUUID } from "node:crypto";

export abstract class BaseAgent {
  readonly type: AgentType;
  readonly name: string;
  protected log = getLogger();

  constructor(type: AgentType, name: string) {
    this.type = type;
    this.name = name;
  }

  /** Get agent capabilities */
  abstract getCapabilities(): AgentCapabilities;

  /** Execute the main agent logic */
  protected abstract execute(context: AgentContext): Promise<TaskResult>;

  /** Run the agent with lifecycle tracking */
  async run(context: AgentContext): Promise<AgentRunResult> {
    const start = Date.now();
    const taskId = context.task.id;

    this.log.info(`Agent ${this.name} starting task: ${taskId}`);

    try {
      const result = await this.execute(context);

      const elapsed = Date.now() - start;
      this.log.info(`Agent ${this.name} completed task ${taskId} in ${elapsed}ms`, {
        success: result.success,
      });

      return {
        success: result.success,
        result,
        tookMs: elapsed,
      };
    } catch (err) {
      const elapsed = Date.now() - start;
      this.log.error(`Agent ${this.name} failed task ${taskId}`, { error: String(err) });

      return {
        success: false,
        result: {
          success: false,
          summary: `Agent ${this.name} failed: ${err}`,
          output: String(err),
          errors: [String(err)],
        },
        tookMs: elapsed,
      };
    }
  }

  /** Check if this agent can handle a specific task */
  canHandle(task: Task): boolean {
    return task.type === this.type;
  }

  /** Create a successful task result */
  protected success(summary: string, output: string, extras?: Partial<TaskResult>): TaskResult {
    return { success: true, summary, output, ...extras };
  }

  /** Create a failed task result */
  protected failure(summary: string, error: string): TaskResult {
    return { success: false, summary, output: error, errors: [error] };
  }

  /** Create a context for sub-tasks */
  protected createContext(task: Task, conversation?: AgentContext["conversation"]): AgentContext {
    return {
      task,
      conversation: conversation || [],
      projectFiles: [],
      availableModels: [],
      memory: {},
    };
  }
}
