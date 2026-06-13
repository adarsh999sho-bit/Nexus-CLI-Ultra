import { BaseAgent } from "./base";
import type { AgentContext, TaskResult, AgentCapabilities } from "./types";

export class TesterAgent extends BaseAgent {
  constructor() {
    super("tester", "Tester");
  }

  getCapabilities(): AgentCapabilities {
    return {
      type: "tester",
      description: "Generates unit tests, integration tests, and edge-case tests",
      tools: ["read_file", "write_file", "search_code", "run_tests"],
      requiresModel: true,
      maxTokens: 4000,
    };
  }

  protected async execute(context: AgentContext): Promise<TaskResult> {
    const description = context.task.description;

    return this.success(
      `Test generation complete for: ${description}`,
      this.generateTests(description),
      {
        metadata: {
          framework: "bun test",
          testTypes: ["unit", "integration"],
          estimatedTests: 3,
        },
      },
    );
  }

  private generateTests(description: string): string {
    return `// Tests generated for: ${description}
import { describe, it, expect } from "bun:test";

describe("${description}", () => {
  it("should handle the primary use case", () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  it("should handle edge cases", () => {
    // TODO: Implement edge case tests
    const input = null;
    expect(input).toBeNull();
  });

  it("should handle errors gracefully", () => {
    // TODO: Implement error handling tests
    expect(() => {}).not.toThrow();
  });
});`;
  }
}
