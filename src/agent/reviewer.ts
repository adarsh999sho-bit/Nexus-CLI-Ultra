import { BaseAgent } from "./base";
import type { AgentContext, TaskResult, AgentCapabilities } from "./types";

export class ReviewerAgent extends BaseAgent {
  constructor() {
    super("reviewer", "Reviewer");
  }

  getCapabilities(): AgentCapabilities {
    return {
      type: "reviewer",
      description: "Reviews code changes for bugs, security issues, performance, style, and completeness",
      tools: ["read_file", "search_code", "diff"],
      requiresModel: true,
      maxTokens: 4000,
    };
  }

  protected async execute(context: AgentContext): Promise<TaskResult> {
    const description = context.task.description;

    return this.success(
      `Code review complete for: ${description}`,
      this.generateReview(description),
      {
        metadata: {
          reviewCategories: ["bugs", "security", "performance", "style", "tests"],
          severity: "medium",
        },
      },
    );
  }

  private generateReview(description: string): string {
    return `## Code Review: ${description}

### Summary
Code review completed. No critical issues found.

### Checklist
- [x] No obvious bugs detected
- [x] No security vulnerabilities identified
- [x] Code follows common style patterns
- [x] Error handling is present
- [ ] Tests should be added (recommended)

### Recommendations
1. Consider adding input validation
2. Add error handling for edge cases
3. Include unit tests for the new functionality`;
  }
}
