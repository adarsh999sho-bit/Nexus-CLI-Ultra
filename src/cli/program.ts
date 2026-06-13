import { Command } from "commander";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

/** Create the root Commander program */
export function createProgram(): Command {
  const program = new Command();

  program
    .name("nexus")
    .description("Nexus CLI Ultra — Open-source AI engineering CLI with context engineering and free model support")
    .version(getVersion());

  // Global options
  program
    .option("-p, --provider <name>", "AI provider to use")
    .option("-m, --model <name>", "Model to use")
    .option("-d, --dir <path>", "Working directory")
    .option("-v, --verbose", "Verbose logging")
    .option("--config <path>", "Path to config file");

  // Register commands
  registerCommands(program);

  return program;
}

function registerCommands(program: Command): void {
  // Interactive chat
  program
    .command("ask [query]")
    .description("Start interactive chat or ask a question")
    .option("--file <path>", "Include file context")
    .action((query, options) => {
      console.log(`[ask] Query: ${query || "(interactive)"}`);
      if (options.file) console.log(`[ask] Context file: ${options.file}`);
    });

  // Plan
  program
    .command("plan <task>")
    .description("Generate an execution plan for a task")
    .option("--output <file>", "Save plan to file")
    .action((task, options) => {
      console.log(`[plan] Task: ${task}`);
      if (options.output) console.log(`[plan] Output: ${options.output}`);
    });

  // Code generation
  program
    .command("code <description>")
    .description("Generate code from a description")
    .option("--language <lang>", "Target language")
    .option("--output <file>", "Output file")
    .action((description, options) => {
      console.log(`[code] ${description}`);
      if (options.language) console.log(`[code] Language: ${options.language}`);
      if (options.output) console.log(`[code] Output: ${options.output}`);
    });

  // Architecture
  program
    .command("architect")
    .description("Generate architecture diagrams from the codebase")
    .option("--output <dir>", "Output directory for diagrams")
    .option("--format <format>", "Output format (mermaid, svg)", "mermaid")
    .action((options) => {
      console.log("[architect] Analyzing codebase architecture...");
      if (options.output) console.log(`[architect] Output: ${options.output}`);
    });

  // Code review
  program
    .command("review [path]")
    .description("Review code for bugs, security issues, and quality")
    .option("--format <format>", "Output format (terminal, json)", "terminal")
    .option("--depth <level>", "Review depth (basic, deep)", "deep")
    .action((path, options) => {
      console.log(`[review] Path: ${path || "."}`);
      console.log(`[review] Depth: ${options.depth}`);
    });

  // Explain
  program
    .command("explain <file>")
    .description("Explain code in detail")
    .option("--output <file>", "Save explanation to file")
    .action((file, options) => {
      console.log(`[explain] File: ${file}`);
      if (options.output) console.log(`[explain] Output: ${options.output}`);
    });

  // Debug
  program
    .command("debug [error-message]")
    .description("Analyze and fix errors")
    .option("--file <path>", "Error log file")
    .action((errorMessage, options) => {
      console.log(`[debug] Error: ${errorMessage || "(interactive)"}`);
      if (options.file) console.log(`[debug] Log file: ${options.file}`);
    });

  // Repair
  program
    .command("repair")
    .description("Auto-fix issues in the codebase")
    .option("--dry-run", "Preview changes without applying")
    .option("--fix <type>", "Fix type (lint, test, security, all)", "all")
    .action((options) => {
      console.log("[repair] Scanning for issues...");
      if (options.dryRun) console.log("[repair] Dry run mode");
    });

  // Test
  program
    .command("test [path]")
    .description("Generate and run tests")
    .option("--runner <name>", "Test runner (bun, vitest, jest)", "bun")
    .option("--watch", "Watch mode")
    .action((path, options) => {
      console.log(`[test] Path: ${path || "."}`);
      console.log(`[test] Runner: ${options.runner}`);
      if (options.watch) console.log("[test] Watch mode enabled");
    });

  // Documentation
  program
    .command("docs [path]")
    .description("Generate documentation")
    .option("--type <type>", "Doc type (readme, api, inline, all)", "all")
    .option("--output <dir>", "Output directory")
    .action((path, options) => {
      console.log(`[docs] Path: ${path || "."}`);
      if (options.output) console.log(`[docs] Output: ${options.output}`);
    });

  // Refactor
  program
    .command("refactor <path>")
    .description("Refactor code intelligently")
    .option("--pattern <pattern>", "Refactoring pattern")
    .option("--dry-run", "Preview changes")
    .action((path, options) => {
      console.log(`[refactor] Path: ${path}`);
      if (options.dryRun) console.log("[refactor] Dry run mode");
    });

  // Commit
  program
    .command("commit")
    .description("Generate commit message from staged changes")
    .option("--type <type>", "Commit type (feat, fix, refactor, docs, etc.)")
    .option("--amend", "Amend last commit")
    .action((options) => {
      console.log("[commit] Analyzing staged changes...");
    });

  // Autonomous solve
  program
    .command("solve <task>")
    .description("Autonomous end-to-end task execution")
    .option("--iterations <n>", "Max iterations", "10")
    .option("--approval", "Require human approval")
    .option("--output <file>", "Save audit trail to file")
    .action((task, options) => {
      console.log(`[solve] Task: ${task}`);
      console.log(`[solve] Max iterations: ${options.iterations}`);
    });

  // Semantic search
  program
    .command("search <query>")
    .description("Semantic codebase search")
    .option("--max-results <n>", "Max results", "10")
    .option("--file <pattern>", "File pattern filter")
    .action((query, options) => {
      console.log(`[search] Query: ${query}`);
    });

  // Knowledge graph
  program
    .command("graph [symbol]")
    .description("Query the knowledge graph")
    .option("--type <type>", "Graph type (impact, dependencies, path)")
    .action((symbol, options) => {
      console.log(`[graph] Symbol: ${symbol || "(all)"}`);
    });

  // Security audit
  program
    .command("security")
    .description("Run security audit on the codebase")
    .option("--format <format>", "Output format (terminal, json)", "terminal")
    .option("--severity <level>", "Minimum severity (low, medium, high, critical)", "medium")
    .action((options) => {
      console.log("[security] Running security audit...");
    });

  // Memory management
  program
    .command("memory")
    .description("View and manage agent memory")
    .option("--clear", "Clear all memory")
    .option("--type <type>", "Memory type (session, repository, user)")
    .action((options) => {
      if (options.clear) {
        console.log("[memory] Clearing memory...");
      } else {
        console.log("[memory] Current memory state:");
      }
    });

  // Context inspection
  program
    .command("context [query]")
    .description("Inspect context assembly for a query")
    .option("--verbose", "Show full context details")
    .action((query, options) => {
      console.log(`[context] Query: ${query || "(current)"}`);
    });

  // Config management
  program
    .command("config")
    .description("Edit or view configuration")
    .option("--get <key>", "Get a config value")
    .option("--set <key> <value>", "Set a config value")
    .option("--list", "List all config")
    .option("--edit", "Open config in editor")
    .action((options) => {
      if (options.list) {
        console.log("[config] Current configuration:");
      } else if (options.get) {
        console.log(`[config] ${options.get}:`);
      } else if (options.edit) {
        console.log("[config] Opening in editor...");
      }
    });

  // Init wizard
  program
    .command("init")
    .description("Initialize Nexus configuration and setup")
    .option("--force", "Overwrite existing config")
    .action((options) => {
      console.log("[init] Starting interactive setup...");
    });

  // Doctor
  program
    .command("doctor")
    .description("System diagnostics and troubleshooting")
    .option("--fix", "Auto-fix detected issues")
    .action((options) => {
      console.log("[doctor] Running diagnostics...");
    });

  // Upgrade
  program
    .command("upgrade")
    .description("Upgrade Nexus CLI Ultra to the latest version")
    .action(() => {
      console.log("[upgrade] Checking for updates...");
    });

  // Status
  program
    .command("status")
    .description("Show current agent status")
    .action(() => {
      console.log("[status] Nexus CLI Ultra Status:");
    });
}

function getVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "../../package.json"), "utf-8"),
    );
    return pkg.version || "0.1.0";
  } catch {
    return "0.1.0";
  }
}
