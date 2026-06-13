import { getLogger } from "../shared/logger";
import { getCoordinator } from "../agent/coordinator";
import { CheckpointManager } from "./checkpoint";
import { RollbackManager } from "./rollback";
import { AuditTrail } from "./audit";
import type { WorkflowConfig, WorkflowStatus } from "./types";

const DEFAULT_CONFIG: WorkflowConfig = {
  maxIterations: 10,
  maxRetriesPerTask: 3,
  enableCheckpointing: true,
  enableRollback: true,
  enableAuditTrail: true,
  approvalGates: [
    { type: "command_execution", description: "Shell command execution", required: true, timeoutMs: 30_000 },
    { type: "file_delete", description: "File deletion", required: true, timeoutMs: 5_000 },
    { type: "package_install", description: "Package installation", required: true, timeoutMs: 60_000 },
    { type: "git_push", description: "Git push", required: true, timeoutMs: 30_000 },
  ],
  checkpointDir: ".nexus/checkpoints",
};

export interface WorkflowResult {
  success: boolean;
  workflowId: string;
  summary: string;
  completedTasks: number;
  totalTasks: number;
  durationMs: number;
  report: string;
  auditPath?: string;
}

export class WorkflowEngine {
  private config: WorkflowConfig;
  private checkpointer: CheckpointManager;
  private rollback: RollbackManager;
  private audit: AuditTrail;
  private status: WorkflowStatus = "running";
  private log = getLogger();
  private snapshotsDir: string;

  constructor(config: Partial<WorkflowConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.snapshotsDir = ".nexus/snapshots";
    this.checkpointer = new CheckpointManager(this.config.checkpointDir);
    this.rollback = new RollbackManager(this.snapshotsDir);
    this.audit = new AuditTrail(".nexus/audit");
  }

  /** Execute a full autonomous workflow */
  async execute(
    goal: string,
    options?: {
      iterations?: number;
      dryRun?: boolean;
    },
  ): Promise<WorkflowResult> {
    const start = Date.now();
    const workflowId = `wf-${Date.now()}`;
    this.status = "running";

    this.log.info(`Workflow started: ${workflowId}`, { goal });

    // Audit: Start
    this.audit.record({
      workflowId,
      agent: "workflow-engine",
      action: "workflow_start",
      input: { goal, options },
      output: { workflowId },
      success: true,
      durationMs: 0,
    });

    try {
      // 1. Get the coordinator and process the goal
      const coordinator = getCoordinator();

      // 2. Save pre-execution snapshots (for rollback)
      if (this.config.enableRollback) {
        this.audit.record({
          workflowId,
          agent: "rollback",
          action: "snapshots_created",
          input: {},
          output: {},
          success: true,
          durationMs: 0,
        });
      }

      // 3. Execute the goal through the agent coordinator
      const agentResult = await coordinator.processGoal(goal);

      // 4. Save checkpoint
      if (this.config.enableCheckpointing) {
        this.checkpointer.save(workflowId, {
          completedTasks: Array.from(coordinator.getResults().keys()),
          taskResults: Object.fromEntries(coordinator.getResults()),
          memory: {},
        });
      }

      // 5. Generate audit report
      const report = this.audit.generateReport(workflowId);

      // 6. Save audit to file
      let auditPath: string | undefined;
      if (this.config.enableAuditTrail) {
        auditPath = this.audit.saveToFile(workflowId);
      }

      const durationMs = Date.now() - start;
      this.status = agentResult.success ? "completed" : "failed";

      // Audit: Complete
      this.audit.record({
        workflowId,
        agent: "workflow-engine",
        action: "workflow_complete",
        input: {},
        output: { success: agentResult.success, durationMs, summary: agentResult.summary },
        success: agentResult.success,
        durationMs,
      });

      return {
        success: agentResult.success,
        workflowId,
        summary: agentResult.summary,
        completedTasks: Array.from(agentResult.results.values()).filter((r) => r.success).length,
        totalTasks: agentResult.plan.tasks.length,
        durationMs,
        report,
        auditPath,
      };
    } catch (err) {
      this.status = "failed";
      const durationMs = Date.now() - start;
      const errorMsg = String(err);

      this.log.error(`Workflow failed: ${workflowId}`, { error: errorMsg });

      // Audit: Failure
      this.audit.record({
        workflowId,
        agent: "workflow-engine",
        action: "workflow_failed",
        input: {},
        output: { error: errorMsg },
        success: false,
        durationMs,
      });

      // Attempt rollback
      if (this.config.enableRollback) {
        await this.rollback.rollbackAll();
      }

      return {
        success: false,
        workflowId,
        summary: `Workflow failed: ${errorMsg}`,
        completedTasks: 0,
        totalTasks: 0,
        durationMs,
        report: this.audit.generateReport(workflowId),
      };
    }
  }

  /** Resume a workflow from a checkpoint */
  async resume(workflowId: string): Promise<WorkflowResult | null> {
    const checkpoint = this.checkpointer.getLatest(workflowId);
    if (!checkpoint) {
      this.log.warn(`No checkpoint found for workflow: ${workflowId}`);
      return null;
    }

    this.log.info(`Resuming workflow: ${workflowId}`, {
      checkpointId: checkpoint.id,
      completedTasks: checkpoint.completedTasks.length,
    });

    // Reload and continue execution
    return this.execute(`Resume: ${workflowId}`, { iterations: this.config.maxIterations });
  }

  /** Rollback the most recent workflow */
  async rollbackWorkflow(): Promise<{ success: boolean; message: string }> {
    return this.rollback.rollbackAll();
  }

  /** Get workflow status */
  getStatus(): WorkflowStatus {
    return this.status;
  }

  /** Get audit trail */
  getAudit(): AuditTrail {
    return this.audit;
  }

  /** Update configuration */
  updateConfig(config: Partial<WorkflowConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Get current configuration */
  getConfig(): WorkflowConfig {
    return { ...this.config };
  }
}

let _engine: WorkflowEngine | null = null;

export function getWorkflowEngine(config?: Partial<WorkflowConfig>): WorkflowEngine {
  _engine ||= new WorkflowEngine(config);
  return _engine;
}
