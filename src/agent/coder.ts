import { BaseAgent } from "./base";
import type { AgentContext, TaskResult, AgentCapabilities } from "./types";

export class CoderAgent extends BaseAgent {
  constructor() {
    super("coder", "Coder");
  }

  getCapabilities(): AgentCapabilities {
    return {
      type: "coder",
      description: "Writes, edits, and generates code files",
      tools: ["read_file", "write_file", "edit_file", "search_code"],
      requiresModel: true,
      maxTokens: 8000,
    };
  }

  protected async execute(context: AgentContext): Promise<TaskResult> {
    const { task } = context;
    const description = task.description;

    // In a full implementation, this would use the LLM to generate code
    return this.success(
      `Code generation complete for: ${description}`,
      `[Coder] Generated code for task: ${description}\n\nThis is a placeholder. Full implementation will integrate with LLM providers (Phase 2) and context engine (Phase 3).`,
      {
        metadata: {
          taskType: "code_generation",
          estimatedFiles: this.estimateFiles(description),
        },
      },
    );
  }

  /** Estimate how many files might be needed for a task */
  private estimateFiles(description: string): number {
    const lowercase = description.toLowerCase();
    let count = 1;
    if (lowercase.includes("component") || lowercase.includes("module")) count += 1;
    if (lowercase.includes("test") || lowercase.includes("spec")) count += 1;
    if (lowercase.includes("config") || lowercase.includes("type") || lowercase.includes("interface")) count += 1;
    if (lowercase.includes("api") || lowercase.includes("route") || lowercase.includes("endpoint")) count += 1;
    return count;
  }
}
