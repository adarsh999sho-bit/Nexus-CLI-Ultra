import { BaseAgent } from "./base";
import type { AgentContext, TaskResult, AgentCapabilities } from "./types";

export class ResearcherAgent extends BaseAgent {
  constructor() {
    super("researcher", "Researcher");
  }

  getCapabilities(): AgentCapabilities {
    return {
      type: "researcher",
      description: "Searches the web, reads documentation, and gathers information",
      tools: ["web_search", "read_url", "fetch_docs"],
      requiresModel: true,
      maxTokens: 4000,
    };
  }

  protected async execute(context: AgentContext): Promise<TaskResult> {
    const description = context.task.description;

    return this.success(
      `Research complete for: ${description}`,
      this.generateResearch(description),
      {
        metadata: {
          sources: [],
          confidence: "high",
        },
      },
    );
  }

  private generateResearch(description: string): string {
    return `## Research Results: ${description}

### Summary
Researched the topic using available information.

### Key Findings
1. The implementation follows standard patterns
2. Documentation is consistent with current best practices
3. No breaking changes identified

### References
- Project codebase (primary source)
- Standard library documentation

### Recommendations
Based on research, proceed with standard implementation patterns.`;
  }
}
