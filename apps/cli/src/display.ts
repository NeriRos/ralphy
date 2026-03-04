import { join } from "node:path";
import type { State } from "@ralphy/types";
import { countProgress } from "@ralphy/core/progress";
import { getStorage } from "@ralphy/context";
import { log, styled, separator } from "@ralphy/output";

export interface ShowBannerOpts {
  mode: string;
  isResume?: boolean;
  noExecute?: boolean;
  maxIterations?: number;
  maxCostUsd?: number;
  maxRuntimeMinutes?: number;
  maxConsecutiveFailures?: number;
  iterationDelay?: number;
  promptFile?: string;
  taskPrompt?: string;
}

/**
 * Display the Ralph Loop banner with task metadata.
 */
export function showBanner(state: State, opts: ShowBannerOpts): void {
  separator();
  log(` ${styled("Ralph Loop", "header")}`);
  separator();

  const resumeTag = opts.isResume ? styled(" (resumed)", "dim") : "";
  log(` ${styled("Mode:", "bold")}       ${opts.mode}${resumeTag}`);

  if (opts.mode === "task") {
    log(` ${styled("Task:", "bold")}       ${state.name}`);
  }

  const engineLabel = state.engine === "claude" ? `${state.engine} (${state.model})` : state.engine;
  log(` ${styled("Engine:", "bold")}     ${engineLabel}`);
  log(` ${styled("Branch:", "bold")}     ${state.metadata.branch ?? "main"}`);

  if (opts.promptFile) {
    log(` ${styled("Prompt:", "bold")}     ${opts.promptFile}`);
  }

  log(` ${styled("No execute:", "bold")} ${opts.noExecute ? "yes (research+plan only)" : "no"}`);

  const maxLabel =
    opts.maxIterations && opts.maxIterations > 0 ? String(opts.maxIterations) : "unlimited";
  log(` ${styled("Max iters:", "bold")}  ${maxLabel}`);

  if (opts.maxCostUsd && opts.maxCostUsd > 0) {
    log(` ${styled("Cost cap:", "bold")}   $${opts.maxCostUsd}`);
  }
  if (opts.maxRuntimeMinutes && opts.maxRuntimeMinutes > 0) {
    log(` ${styled("Runtime:", "bold")}    ${opts.maxRuntimeMinutes} min`);
  }
  if (opts.maxConsecutiveFailures && opts.maxConsecutiveFailures > 0) {
    log(` ${styled("Fail limit:", "bold")} ${opts.maxConsecutiveFailures} consecutive`);
  }

  if (opts.iterationDelay && opts.iterationDelay > 0) {
    log(` ${styled("Delay:", "bold")}      ${opts.iterationDelay}s between runs`);
  }

  if (opts.mode === "task" && opts.taskPrompt) {
    const lines = opts.taskPrompt.split("\n");
    const maxLines = 6;
    separator();
    log(` ${styled("Prompt:", "bold")}`);
    for (const line of lines.slice(0, maxLines)) {
      log(`  ${styled(line, "gray")}`);
    }
    if (lines.length > maxLines) {
      log(styled(`  … (${lines.length - maxLines} more lines)`, "dim"));
    }
  }

  separator();
}

/**
 * Display detailed status for a single task.
 */
export function showStatus(state: State, taskDir: string): void {
  log("============================================");
  log(` Task Status: ${state.name}`);
  log("============================================");
  log(` Phase:            ${state.phase}`);
  log(` Phase iteration:  ${state.phaseIteration}`);
  log(` Total iterations: ${state.totalIterations}`);
  log(` Status:           ${state.status}`);
  log(` Engine:           ${state.engine} (${state.model})`);
  log(` Created:          ${state.createdAt}`);
  log(` Last modified:    ${state.lastModified}`);
  log(` Branch:           ${state.metadata.branch ?? "—"}`);
  log("--------------------------------------------");

  const cost = Math.round(state.usage.total_cost_usd * 100) / 100;
  const time = Math.round((state.usage.total_duration_ms / 1000) * 10) / 10 + "s";
  log(" Usage:");
  log(`   Cost:           $${cost}`);
  log(`   Time:           ${time}`);
  log(`   Turns:          ${state.usage.total_turns}`);
  log(`   Input tokens:   ${state.usage.total_input_tokens}`);
  log(`   Output tokens:  ${state.usage.total_output_tokens}`);
  log(`   Cached tokens:  ${state.usage.total_cache_read_input_tokens}`);
  log("--------------------------------------------");

  const storage = getStorage();
  log(" Files:");
  for (const f of ["RESEARCH.md", "PLAN.md", "PROGRESS.md"]) {
    const content = storage.read(join(taskDir, f));
    log(`   ${content !== null ? "[x]" : "[ ]"} ${f}`);
  }

  const progressContent = storage.read(join(taskDir, "PROGRESS.md"));
  if (progressContent !== null) {
    const { checked, unchecked } = countProgress(progressContent);
    log(` Progress:         ${checked} done / ${unchecked} remaining`);
  }

  log("--------------------------------------------");
  log(" History (last 10):");
  const recent = state.history.slice(-10);
  for (const entry of recent) {
    log(
      `   ${entry.timestamp} | ${entry.phase} iter ${entry.iteration} | ${entry.engine}/${entry.model} | ${entry.result}`,
    );
  }
  log("============================================");
}

/**
 * List all incomplete tasks in the tasks directory.
 */
export function showList(tasksDir: string): void {
  log("============================================");
  log(" Incomplete Tasks");
  log("============================================");

  let found = false;

  const storage = getStorage();
  const entries = storage.list(tasksDir);

  if (entries.length === 0) {
    log(" No tasks directory found.");
    log("============================================");
    return;
  }

  for (const entry of entries) {
    const raw = storage.read(join(tasksDir, entry, "state.json"));
    if (raw === null) continue;

    let state: Record<string, unknown>;
    try {
      state = JSON.parse(raw);
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
    const progressContent = storage.read(join(tasksDir, entry, "PROGRESS.md"));
    if (progressContent !== null) {
      const { checked, unchecked } = countProgress(progressContent);
      progressInfo = ` | progress: ${checked} done / ${unchecked} remaining`;
    }

    const namePad = name.padEnd(20);
    log(
      ` ${namePad}  phase: ${phase.padEnd(8)}  status: ${status.padEnd(8)}  iters: ${total}${progressInfo}`,
    );
    log(`   ${prompt}`);
  }

  if (!found) {
    log(" No incomplete tasks found.");
  }
  log("============================================");
}
