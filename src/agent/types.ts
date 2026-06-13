import type { LlmMessage } from "../llm/types";

/** The type of an agent */
export type AgentType = "planner" | "coder" | "reviewer" | "tester" | "researcher" | "security" | "debugger" | "docs";

/** Task status in the workflow */
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "blocked";

/** A task that can be assigned to an agent */
export interface Task {
  id: string;
  description: string;
  type: AgentType;
  status: TaskStatus;
  dependencies: string[];  // Task IDs this task depends on
  context: Record<string, unknown>;
  result?: TaskResult;
  createdAt: Date;
  updatedAt: Date;
}

/** Result from an agent execution */
export interface TaskResult {
  success: boolean;
  summary: string;
  output: string;
  filesChanged?: string[];
  errors?: string[];
  metadata?: Record<string, unknown>;
}

/** Context provided to an agent when running */
export interface AgentContext {
  task: Task;
  conversation: LlmMessage[];
  projectFiles: string[];
  availableModels: string[];
  memory: Record<string, unknown>;
  signal?: AbortSignal;
}

/** Agent capabilities declaration */
export interface AgentCapabilities {
  type: AgentType;
  description: string;
  tools: string[];
  requiresModel: boolean;
  maxTokens: number;
}

/** Result from an agent's run method */
export interface AgentRunResult {
  success: boolean;
  result: TaskResult;
  tookMs: number;
  tokenUsage?: { input: number; output: number };
}

/** Workflow plan produced by the Planner */
export interface WorkflowPlan {
  id: string;
  goal: string;
  tasks: Task[];
  dependencies: Map<string, string[]>;  // taskId -> dependency taskIds
  estimatedComplexity: "simple" | "moderate" | "complex";
}

/** Approval request for human review */
export interface ApprovalRequest {
  id: string;
  taskId: string;
  type: "file_edit" | "command_execution" | "package_install" | "git_push" | "file_delete";
  description: string;
  details: string;
  createdAt: Date;
}
