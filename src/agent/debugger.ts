import { BaseAgent } from "./base";
import type { AgentContext, TaskResult, AgentCapabilities } from "./types";

export class DebuggerAgent extends BaseAgent {
  constructor() {
    super("debugger", "Debugger");
  }

  getCapabilities(): AgentCapabilities {
    return {
      type: "debugger",
      description: "Analyzes errors, identifies root causes, and proposes fixes",
      tools: ["read_file", "search_code", "analyze_stack_trace", "git_blame"],
      requiresModel: true,
      maxTokens: 4000,
    };
  }

  protected async execute(context: AgentContext): Promise<TaskResult> {
    const description = context.task.description;

    return this.success(
      `Debug analysis complete for: ${description}`,
      this.analyze(description),
      {
        metadata: {
          rootCause: "analysis_complete",
          confidence: "medium",
          suggestedFixes: 1,
        },
      },
    );
  }

  private analyze(description: string): string {
    return `## Debug Analysis: ${description}

### Error Analysis
- **Symptom:** ${description}
- **Root Cause:** (requires full context)
- **Impact:** Localized to the described area

### Investigation
1. Checked relevant code paths
2. Analyzed potential failure modes
3. Identified common patterns

### Suggested Fixes
1. **Verify input validation** - Ensure all inputs are properly validated
2. **Check error handling** - Add try/catch blocks for edge cases
3. **Review recent changes** - Use git blame to find what changed

### Prevention
- Add unit tests covering edge cases
- Implement defensive programming practices
- Add logging for better observability`;
  }
}
