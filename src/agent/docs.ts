import { BaseAgent } from "./base";
import type { AgentContext, TaskResult, AgentCapabilities } from "./types";

export class DocsAgent extends BaseAgent {
  constructor() {
    super("docs", "Documenter");
  }

  getCapabilities(): AgentCapabilities {
    return {
      type: "docs",
      description: "Generates and updates documentation including README, API docs, inline comments, and changelogs",
      tools: ["read_file", "write_file", "search_code"],
      requiresModel: true,
      maxTokens: 4000,
    };
  }

  protected async execute(context: AgentContext): Promise<TaskResult> {
    const description = context.task.description;

    return this.success(
      `Documentation generated for: ${description}`,
      this.generateDocs(description),
      {
        metadata: {
          docTypes: ["readme", "api", "inline"],
          estimatedSize: "medium",
        },
      },
    );
  }

  private generateDocs(description: string): string {
    return `## Documentation: ${description}

### Overview
${description}

### Usage
\`\`\`typescript
// Example usage
import { Nexus } from "nexus-cli-ultra";

const result = await Nexus.process("${description}");
console.log(result);
\`\`\`

### API Reference
| Parameter | Type | Description |
|-----------|------|-------------|
| input | string | The input to process |
| options | object | Configuration options |

### Notes
- Ensure all dependencies are installed
- Follow the established patterns in the codebase
- Run tests before committing`;
  }
}
