import { readFileSync, existsSync, copyFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import type { State, Phase } from "@ralphy/types";
import { readState, writeState, updateState, buildInitialState } from "@ralphy/core/state";
import { extractCurrentSection, countProgress } from "@ralphy/core/progress";
import { renderTemplate, resolvePromptPath, resolveTemplatePath } from "@ralphy/core/templates";
import { runEngine, handleEngineFailure, type EngineResult } from "@ralphy/engine/engine";
import { autoTransitionAfterExec, autoTransitionAfterReview } from "@ralphy/core/phases";
import { gitPush } from "@ralphy/core/git";
import { showBanner } from "./display";

export interface LoopOptions {
  name: string;
  prompt: string;
  engine: "claude" | "codex";
  model: string;
  maxIterations: number;
  noExecute: boolean;
  delay: number;
  log: boolean;
  tasksDir: string;
}

/**
 * Build the full prompt for a task iteration by concatenating:
 * 1. STEERING.md content (if present, filtered, max 20 lines)
 * 2. Phase-specific prompt file
 * 3. Phase-specific context (research findings, current section, checklists)
 */
export function buildTaskPrompt(state: State, taskDir: string): string {
  const phase = state.phase as Phase;
  let prompt = "";

  // 1. Inject STEERING.md at the top
  const steeringPath = join(taskDir, "STEERING.md");
  if (existsSync(steeringPath)) {
    const steering = readFileSync(steeringPath, "utf-8");
    const lines = steering
      .split("\n")
      .filter((line) => !line.startsWith("#"))
      .filter((line) => line.trim())
      .slice(0, 20);
    if (lines.length > 0) {
      prompt += "---\n";
      prompt += "# 📌 User Steering (READ FIRST)\n\n";
      prompt += lines.join("\n") + "\n\n";
      prompt += "---\n\n";
    }
  }

  // 2. Phase prompt
  const phasePromptPath = resolvePromptPath(`task_${phase}`);
  if (existsSync(phasePromptPath)) {
    prompt += readFileSync(phasePromptPath, "utf-8");
  }

  // 3. Phase-specific context
  switch (phase) {
    case "plan": {
      const researchPath = join(taskDir, "RESEARCH.md");
      if (existsSync(researchPath)) {
        prompt += "\n---\n\n## Research Findings\n\n";
        prompt += readFileSync(researchPath, "utf-8");
      }
      break;
    }

    case "exec": {
      const progressPath = join(taskDir, "PROGRESS.md");
      if (existsSync(progressPath)) {
        const section = extractCurrentSection(readFileSync(progressPath, "utf-8"));
        if (section) {
          prompt += "\n" + section;
        }
      }
      // Append rendered checklist templates
      for (const tmplName of ["checklist_static", "checklist_tests", "checklist_deploy"]) {
        const tmplPath = resolveTemplatePath(tmplName);
        if (existsSync(tmplPath)) {
          const content = readFileSync(tmplPath, "utf-8");
          const rendered = renderTemplate(content, buildTemplateVars(state, taskDir));
          prompt += "\n" + rendered;
        }
      }
      break;
    }

    case "review": {
      const progressPath = join(taskDir, "PROGRESS.md");
      if (existsSync(progressPath)) {
        prompt += "\n---\n\n## Current Section (to review)\n\n";
        const section = extractCurrentSection(readFileSync(progressPath, "utf-8"));
        if (section) {
          prompt += section;
        }
      }
      break;
    }
  }

  return prompt;
}

/**
 * Build the template variable map for renderTemplate.
 */
function buildTemplateVars(state: State, taskDir: string): Record<string, string> {
  return {
    TASK_NAME: state.name,
    TASK_DIR: taskDir,
    TASK_PROMPT: state.prompt,
    DATE: new Date().toISOString().split("T")[0]!,
    PHASE: state.phase,
    PHASE_ITERATION: String(state.phaseIteration),
  };
}

/**
 * Scaffold task files that should exist for a new task.
 * Currently copies STEERING.md template if missing.
 */
function scaffoldTaskFiles(taskDir: string): void {
  const steeringDest = join(taskDir, "STEERING.md");
  if (!existsSync(steeringDest)) {
    const tmplPath = resolveTemplatePath("STEERING");
    if (existsSync(tmplPath)) {
      copyFileSync(tmplPath, steeringDest);
    }
  }
}

/**
 * Check for a STOP signal file in the task directory.
 * If found, reads the reason, removes the file, marks state as blocked.
 * Returns the reason string if stopped, null otherwise.
 */
function checkStopSignal(taskDir: string): string | null {
  const stopFile = join(taskDir, "STOP");
  if (!existsSync(stopFile)) return null;

  const reason = readFileSync(stopFile, "utf-8").trim();
  unlinkSync(stopFile);

  console.log(`\n${chalk.yellow.bold("STOP signal detected.")}`);
  console.log(`Reason: ${reason}`);

  updateState(taskDir, (s) => ({
    ...s,
    status: "blocked",
    lastModified: new Date().toISOString(),
  }));

  return reason;
}

/**
 * Determine whether the loop should continue.
 */
function shouldContinue(state: State, iteration: number, opts: LoopOptions): boolean {
  if (opts.maxIterations > 0 && iteration >= opts.maxIterations) return false;
  if (state.phase === "done") return false;
  if (opts.noExecute && state.phase === "exec") return false;
  return true;
}

/**
 * Update state after a completed iteration.
 */
function updateStateIteration(
  taskDir: string,
  result: string,
  startedAt: string,
  engine: string,
  model: string,
  usage: EngineResult["usage"],
): State {
  return updateState(taskDir, (s) => {
    const now = new Date().toISOString();
    const newState: State = {
      ...s,
      phaseIteration: s.phaseIteration + 1,
      totalIterations: s.totalIterations + 1,
      lastModified: now,
      engine,
      model,
      history: [
        ...s.history,
        {
          timestamp: now,
          startedAt,
          endedAt: now,
          phase: s.phase,
          iteration: s.phaseIteration + 1,
          engine,
          model,
          result,
          usage: usage
            ? {
                cost_usd: usage.cost_usd,
                duration_ms: usage.duration_ms,
                num_turns: usage.num_turns,
                input_tokens: usage.input_tokens,
                output_tokens: usage.output_tokens,
                cache_read_input_tokens: usage.cache_read_input_tokens,
                cache_creation_input_tokens: usage.cache_creation_input_tokens,
              }
            : undefined,
        },
      ],
    };

    // Accumulate usage totals if engine reported stats
    if (usage) {
      newState.usage = {
        total_cost_usd: s.usage.total_cost_usd + (usage.cost_usd ?? 0),
        total_duration_ms: s.usage.total_duration_ms + (usage.duration_ms ?? 0),
        total_turns: s.usage.total_turns + (usage.num_turns ?? 0),
        total_input_tokens: s.usage.total_input_tokens + (usage.input_tokens ?? 0),
        total_output_tokens: s.usage.total_output_tokens + (usage.output_tokens ?? 0),
        total_cache_read_input_tokens:
          s.usage.total_cache_read_input_tokens + (usage.cache_read_input_tokens ?? 0),
        total_cache_creation_input_tokens:
          s.usage.total_cache_creation_input_tokens + (usage.cache_creation_input_tokens ?? 0),
      };
    }

    return newState;
  });
}

/**
 * Sleep for the given number of seconds.
 */
function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

/**
 * Main iteration loop. Initialises or resumes a task, builds prompts,
 * runs the engine, handles transitions, and checks stop signals.
 */
export async function mainLoop(opts: LoopOptions): Promise<void> {
  const taskDir = join(opts.tasksDir, opts.name);

  // Ensure task directory exists
  const { mkdirSync } = await import("node:fs");
  mkdirSync(taskDir, { recursive: true });

  // Init or resume state
  let state: State;
  if (existsSync(join(taskDir, "state.json"))) {
    state = readState(taskDir);
    // Update engine/model if caller specified different ones
    if (state.engine !== opts.engine || state.model !== opts.model) {
      state = { ...state, engine: opts.engine, model: opts.model };
      writeState(taskDir, state);
    }
  } else {
    state = buildInitialState({
      name: opts.name,
      prompt: opts.prompt,
      engine: opts.engine,
      model: opts.model,
    });
    writeState(taskDir, state);
  }

  const isResume = state.totalIterations > 0;

  // Scaffold task files (e.g. STEERING.md)
  scaffoldTaskFiles(taskDir);

  // Show banner
  showBanner(state, {
    mode: "task",
    isResume,
    noExecute: opts.noExecute,
    maxIterations: opts.maxIterations,
    iterationDelay: opts.delay,
    taskPrompt: opts.prompt || state.prompt,
  });

  let iteration = 0;

  while (true) {
    // Re-read state at top of each iteration (may have been updated by transitions)
    state = readState(taskDir);

    if (!shouldContinue(state, iteration, opts)) {
      if (state.phase === "done") {
        const progressPath = join(taskDir, "PROGRESS.md");
        if (existsSync(progressPath)) {
          const { checked, unchecked } = countProgress(readFileSync(progressPath, "utf-8"));
          console.log(
            `\nAll items checked (${checked} done / ${unchecked} remaining). Task complete!`,
          );
        }
        console.log(`See: ${taskDir}/PROGRESS.md`);
      } else if (opts.noExecute && state.phase === "exec") {
        console.log("\nResearch and planning complete. Stopping before execution (--no-execute).");
        console.log(`See: ${taskDir}/PLAN.md, ${taskDir}/PROGRESS.md`);
      } else if (opts.maxIterations > 0 && iteration >= opts.maxIterations) {
        console.log(`\nReached max iterations: ${opts.maxIterations}`);
      }
      break;
    }

    iteration++;

    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    console.log(`\n======== ITERATION ${iteration} ${time} ========\n`);

    // Show phase info
    const phase = state.phase as Phase;
    console.log(` Phase: ${phase} (iteration ${state.phaseIteration})`);

    if (phase === "exec" || phase === "review") {
      const progressPath = join(taskDir, "PROGRESS.md");
      if (existsSync(progressPath)) {
        const progressContent = readFileSync(progressPath, "utf-8");
        const section = extractCurrentSection(progressContent);
        if (section) {
          const firstLine = section.split("\n")[0];
          console.log(` Section: ${firstLine}`);
        }
        const { checked, unchecked } = countProgress(progressContent);
        console.log(` Progress: ${checked} done / ${unchecked} remaining`);
        if (phase === "review") {
          console.log(" (Reviewing section for quality/correctness...)");
        }
      }
    }
    console.log("");

    // Build prompt
    const prompt = buildTaskPrompt(state, taskDir);

    // Run engine
    const iterStart = new Date().toISOString();
    let engineResult: EngineResult;
    try {
      engineResult = await runEngine({
        engine: opts.engine,
        model: opts.model,
        prompt,
        logFlag: opts.log,
        taskDir,
      });
    } catch (err) {
      console.error(chalk.red(`Engine spawn error: ${err}`));
      break;
    }

    if (engineResult.exitCode !== 0) {
      const failure = handleEngineFailure(engineResult.exitCode);
      console.log(`\n${chalk.red.bold(failure.message)}`);

      updateStateIteration(
        taskDir,
        `failed:exit-${engineResult.exitCode}`,
        iterStart,
        opts.engine,
        opts.model,
        engineResult.usage,
      );

      if (failure.shouldStop) break;
      // Non-fatal failures: break this iteration but don't exit the loop
      // The shell version exits on any failure, so match that behavior
      break;
    }

    // Update state with successful iteration
    state = updateStateIteration(
      taskDir,
      "success",
      iterStart,
      opts.engine,
      opts.model,
      engineResult.usage,
    );

    // Auto-transition
    if (phase === "exec") {
      state = autoTransitionAfterExec(state, taskDir);
    } else if (phase === "review") {
      state = autoTransitionAfterReview(state, taskDir);
    }

    // Push to remote
    try {
      gitPush();
    } catch {
      // Push failures are non-fatal
    }

    // Check STOP signal
    if (checkStopSignal(taskDir)) break;

    console.log(`\n======== COMPLETED ITERATION ${iteration} ========\n`);

    // Delay between iterations if configured
    if (shouldContinue(state, iteration, opts) && opts.delay > 0) {
      console.log(`  [wait] Sleeping ${opts.delay}s before next iteration...\n`);
      await sleep(opts.delay);
    }
  }

  console.log(`Ralph loop finished after ${iteration} iterations.`);

  // Final push
  if (iteration > 0) {
    try {
      gitPush();
    } catch {
      // Push failures are non-fatal
    }
  }
}
