import chalk from "chalk";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { State } from "./types";
import { countProgress } from "./progress";

const SEP = chalk.gray("━".repeat(44));

export interface ShowBannerOpts {
  mode: string;
  isResume?: boolean;
  noExecute?: boolean;
  maxIterations?: number;
  iterationDelay?: number;
  promptFile?: string;
  taskPrompt?: string;
}

/**
 * Display the Ralph Loop banner with task metadata.
 */
export function showBanner(state: State, opts: ShowBannerOpts): void {
  console.log(SEP);
  console.log(` ${chalk.bold.cyan("Ralph Loop")}`);
  console.log(SEP);

  const resumeTag = opts.isResume ? chalk.dim(" (resumed)") : "";
  console.log(` ${chalk.bold("Mode:")}       ${opts.mode}${resumeTag}`);

  if (opts.mode === "task") {
    console.log(` ${chalk.bold("Task:")}       ${state.name}`);
  }

  const engineLabel =
    state.engine === "claude"
      ? `${state.engine} (${state.model})`
      : state.engine;
  console.log(` ${chalk.bold("Engine:")}     ${engineLabel}`);
  console.log(
    ` ${chalk.bold("Branch:")}     ${state.metadata.branch ?? "main"}`,
  );

  if (opts.promptFile) {
    console.log(` ${chalk.bold("Prompt:")}     ${opts.promptFile}`);
  }

  console.log(
    ` ${chalk.bold("No execute:")} ${opts.noExecute ? "yes (research+plan only)" : "no"}`,
  );

  const maxLabel =
    opts.maxIterations && opts.maxIterations > 0
      ? String(opts.maxIterations)
      : "unlimited";
  console.log(` ${chalk.bold("Max iters:")}  ${maxLabel}`);

  if (opts.iterationDelay && opts.iterationDelay > 0) {
    console.log(
      ` ${chalk.bold("Delay:")}      ${opts.iterationDelay}s between runs`,
    );
  }

  if (opts.mode === "task" && opts.taskPrompt) {
    const lines = opts.taskPrompt.split("\n");
    const maxLines = 6;
    console.log(SEP);
    console.log(` ${chalk.bold("Prompt:")}`);
    for (const line of lines.slice(0, maxLines)) {
      console.log(`  ${chalk.gray(line)}`);
    }
    if (lines.length > maxLines) {
      console.log(chalk.dim(`  … (${lines.length - maxLines} more lines)`));
    }
  }

  console.log(SEP);
}

/**
 * Display detailed status for a single task.
 */
export function showStatus(state: State, taskDir: string): void {
  console.log("============================================");
  console.log(` Task Status: ${state.name}`);
  console.log("============================================");
  console.log(` Phase:            ${state.phase}`);
  console.log(` Phase iteration:  ${state.phaseIteration}`);
  console.log(` Total iterations: ${state.totalIterations}`);
  console.log(` Status:           ${state.status}`);
  console.log(` Engine:           ${state.engine} (${state.model})`);
  console.log(` Created:          ${state.createdAt}`);
  console.log(` Last modified:    ${state.lastModified}`);
  console.log(` Branch:           ${state.metadata.branch ?? "—"}`);
  console.log("--------------------------------------------");

  const cost = Math.round(state.usage.total_cost_usd * 100) / 100;
  const time =
    Math.round((state.usage.total_duration_ms / 1000) * 10) / 10 + "s";
  console.log(" Usage:");
  console.log(`   Cost:           $${cost}`);
  console.log(`   Time:           ${time}`);
  console.log(`   Turns:          ${state.usage.total_turns}`);
  console.log(`   Input tokens:   ${state.usage.total_input_tokens}`);
  console.log(`   Output tokens:  ${state.usage.total_output_tokens}`);
  console.log(
    `   Cached tokens:  ${state.usage.total_cache_read_input_tokens}`,
  );
  console.log("--------------------------------------------");

  console.log(" Files:");
  for (const f of ["RESEARCH.md", "PLAN.md", "PROGRESS.md"]) {
    const exists = existsSync(join(taskDir, f));
    console.log(`   ${exists ? "[x]" : "[ ]"} ${f}`);
  }

  const progressPath = join(taskDir, "PROGRESS.md");
  if (existsSync(progressPath)) {
    const content = readFileSync(progressPath, "utf-8");
    const { checked, unchecked } = countProgress(content);
    console.log(` Progress:         ${checked} done / ${unchecked} remaining`);
  }

  console.log("--------------------------------------------");
  console.log(" History (last 10):");
  const recent = state.history.slice(-10);
  for (const entry of recent) {
    console.log(
      `   ${entry.timestamp} | ${entry.phase} iter ${entry.iteration} | ${entry.engine}/${entry.model} | ${entry.result}`,
    );
  }
  console.log("============================================");
}

/**
 * List all incomplete tasks in the tasks directory.
 */
export function showList(tasksDir: string): void {
  console.log("============================================");
  console.log(" Incomplete Tasks");
  console.log("============================================");

  let found = false;

  let entries: string[];
  try {
    entries = readdirSync(tasksDir);
  } catch {
    console.log(" No tasks directory found.");
    console.log("============================================");
    return;
  }

  for (const entry of entries) {
    const stateFile = join(tasksDir, entry, "state.json");
    if (!existsSync(stateFile)) continue;

    let state: Record<string, unknown>;
    try {
      state = JSON.parse(readFileSync(stateFile, "utf-8"));
    } catch {
      continue;
    }

    if (state.phase === "done") continue;
    found = true;

    const name = String(state.name ?? entry);
    const phase = String(state.phase ?? "unknown");
    const status = String(state.status ?? "unknown");
    const total = String(state.totalIterations ?? 0);
    const prompt = String(state.prompt ?? "").slice(0, 60);

    let progressInfo = "";
    const progressFile = join(tasksDir, entry, "PROGRESS.md");
    if (existsSync(progressFile)) {
      const content = readFileSync(progressFile, "utf-8");
      const { checked, unchecked } = countProgress(content);
      progressInfo = ` | progress: ${checked} done / ${unchecked} remaining`;
    }

    const namePad = name.padEnd(20);
    console.log(
      ` ${namePad}  phase: ${phase.padEnd(8)}  status: ${status.padEnd(8)}  iters: ${total}${progressInfo}`,
    );
    console.log(`   ${prompt}`);
  }

  if (!found) {
    console.log(" No incomplete tasks found.");
  }
  console.log("============================================");
}
