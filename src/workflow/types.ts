/** Status of a workflow execution */
export type WorkflowStatus = "running" | "paused" | "completed" | "failed" | "rolled_back";

/** A checkpoint snapshot of execution state */
export interface Checkpoint {
  id: string;
  workflowId: string;
  timestamp: Date;
  completedTasks: string[];
  taskResults: Record<string, unknown>;
  gitHash?: string;
  memory: Record<string, unknown>;
}

/** An audit trail entry */
export interface AuditEntry {
  id: string;
  workflowId: string;
  timestamp: Date;
  agent: string;
  action: string;
  input: unknown;
  output: unknown;
  success: boolean;
  durationMs: number;
}

/** Rollback action to undo a change */
export interface RollbackAction {
  type: "file_restore" | "git_revert" | "command_undo";
  description: string;
  file?: string;
  originalContent?: string;
  gitCommand?: string;
  timestamp: Date;
}

/** Approval gate configuration */
export interface ApprovalGate {
  type: "command_execution" | "file_delete" | "package_install" | "git_push";
  description: string;
  required: boolean;
  timeoutMs: number;
}

/** Configuration for the workflow engine */
export interface WorkflowConfig {
  maxIterations: number;
  maxRetriesPerTask: number;
  enableCheckpointing: boolean;
  enableRollback: boolean;
  enableAuditTrail: boolean;
  approvalGates: ApprovalGate[];
  checkpointDir: string;
}
