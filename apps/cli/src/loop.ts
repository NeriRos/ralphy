import { join } from "node:path";
import chalk from "chalk";
import type { State } from "@ralphy/types";
import { readState, writeState, updateState, buildInitialState } from "@ralphy/core/state";
import { extractCurrentSection, countProgress } from "@ralphy/core/progress";
import { renderTemplate, resolveTemplatePath } from "@ralphy/core/templates";
import { runEngine, handleEngineFailure, type EngineResult } from "@ralphy/engine/engine";
import { autoTransitionAfterIteration } from "@ralphy/core/phases";
import { getPhase } from "@ralphy/phases";
import { gitPush } from "@ralphy/core/git";
import { getStorage, runWithContext, createDefaultContext } from "@ralphy/context";
import { log, error } from "@ralphy/output";
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
 * 2. Phase-specific prompt from phase config
 * 3. Phase-specific context driven by phase config's `context` array
 */
export function buildTaskPrompt(state: State, taskDir: string): string {
  const phaseConfig = getPhase(state.phase);
  let prompt = "";

  // 1. Inject STEERING.md at the top
  const storage = getStorage();
  const steering = storage.read(join(taskDir, "STEERING.md"));
  if (steering !== null) {
    const lines = steering
      .split("\n")
      .filter((line) => !line.startsWith("#"))
      .filter((line) => line.trim())
      .slice(0, 20);
    if (lines.length > 0) {
      prompt += "---\n";
      prompt += "# User Steering (READ FIRST)\n\n";
      prompt += lines.join("\n") + "\n\n";
      prompt += "---\n\n";
    }
  }

  // 2. Phase prompt (rendered with template vars)
  if (phaseConfig.prompt) {
    prompt += renderTemplate(phaseConfig.prompt, buildTemplateVars(state, taskDir));
  }

  // 3. Context injection driven by phase config
  for (const entry of phaseConfig.context) {
    switch (entry.type) {
      case "file": {
        const content = storage.read(join(taskDir, entry.file));
        if (content !== null) {
          prompt += `\n---\n\n## ${entry.label}\n\n`;
          prompt += content;
        }
        break;
      }
      case "currentSection": {
        const progressContent = storage.read(join(taskDir, "PROGRESS.md"));
        if (progressContent !== null) {
          const section = extractCurrentSection(progressContent);
          if (section) {
            if (entry.label) {
              prompt += `\n---\n\n## ${entry.label}\n\n`;
            }
            prompt += "\n" + section;
          }
        }
        break;
      }
    }
  }

  return prompt;
}

/**
 * Build the template variable map for renderTemplate.
 */
function buildTemplateVars(state: State, taskDir: string): Record<string, string> {
  const mcpTools =
    state.engine === "claude"
      ? [
          "",
          "## MCP Tools Available",
          "",
          "You have access to ralph MCP tools. **Use these instead of shell commands where applicable:**",
          "",
          "- `ralph_advance_phase(name)` — Advance this task to the next phase. **Use this instead of `./loop.sh advance`.**",
          "- `ralph_read_document(name, document)` — Read task documents (RESEARCH.md, PLAN.md, PROGRESS.md, STEERING.md)",
          "- `ralph_get_task(name)` — Get task status, metadata, and progress",
          "- `ralph_list_checklists()` — List available verification checklists with their contents",
          '- `ralph_apply_checklist(name, checklists)` — Append checklists as sections to PROGRESS.md (e.g. `["checklist_static", "checklist_tests"]`)',
          "",
          `Task name: \`${state.name}\``,
          "",
        ].join("\n")
      : "";

  return {
    TASK_NAME: state.name,
    TASK_DIR: taskDir,
    TASK_PROMPT: state.prompt,
    DATE: new Date().toISOString().split("T")[0]!,
    PHASE: state.phase,
    PHASE_ITERATION: String(state.phaseIteration),
    MCP_TOOLS: mcpTools,
  };
}

/**
 * Scaffold task files that should exist for a new task.
 * Currently copies STEERING.md template if missing.
 */
function scaffoldTaskFiles(taskDir: string): void {
  const storage = getStorage();
  if (storage.read(join(taskDir, "STEERING.md")) === null) {
    const tmpl = storage.read(resolveTemplatePath("STEERING"));
    if (tmpl !== null) {
      storage.write(join(taskDir, "STEERING.md"), tmpl);
    }
  }
}

/**
 * Check for a STOP signal file in the task directory.
 * If found, reads the reason, removes the file, marks state as blocked.
 * Returns the reason string if stopped, null otherwise.
 */
function checkStopSignal(taskDir: string): string | null {
  const storage = getStorage();
  const stopFile = join(taskDir, "STOP");
  const reason = storage.read(stopFile);
  if (reason === null) return null;

  storage.remove(stopFile);

  log(`\n${chalk.yellow.bold("STOP signal detected.")}`);
  log(`Reason: ${reason.trim()}`);

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
  const phaseConfig = getPhase(state.phase);
  if (phaseConfig.terminal) return false;
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
  return runWithContext(createDefaultContext(), () => _mainLoop(opts));
}

async function _mainLoop(opts: LoopOptions): Promise<void> {
  const taskDir = join(opts.tasksDir, opts.name);
  const storage = getStorage();

  // Init or resume state
  let state: State;
  const existingState = storage.read(join(taskDir, "state.json"));
  if (existingState !== null) {
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
      const phaseConfig = getPhase(state.phase);
      if (phaseConfig.terminal) {
        const progressContent = storage.read(join(taskDir, "PROGRESS.md"));
        if (progressContent !== null) {
          const { checked, unchecked } = countProgress(progressContent);
          log(`\nAll items checked (${checked} done / ${unchecked} remaining). Task complete!`);
        }
        log(`See: ${taskDir}/PROGRESS.md`);
      } else if (opts.noExecute && state.phase === "exec") {
        log("\nResearch and planning complete. Stopping before execution (--no-execute).");
        log(`See: ${taskDir}/PLAN.md, ${taskDir}/PROGRESS.md`);
      } else if (opts.maxIterations > 0 && iteration >= opts.maxIterations) {
        log(`\nReached max iterations: ${opts.maxIterations}`);
      }
      break;
    }

    iteration++;

    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    log(`\n======== ITERATION ${iteration} ${time} ========\n`);

    // Show phase info
    log(` Phase: ${state.phase} (iteration ${state.phaseIteration})`);

    const progressContent = storage.read(join(taskDir, "PROGRESS.md"));
    if (progressContent !== null) {
      const section = extractCurrentSection(progressContent);
      if (section) {
        const firstLine = section.split("\n")[0];
        log(` Section: ${firstLine}`);
      }
      const { checked, unchecked } = countProgress(progressContent);
      log(` Progress: ${checked} done / ${unchecked} remaining`);
    }
    log("");

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
      error(chalk.red(`Engine spawn error: ${err}`));
      break;
    }

    if (engineResult.exitCode !== 0) {
      const failure = handleEngineFailure(engineResult.exitCode);
      log(`\n${chalk.red.bold(failure.message)}`);

      updateStateIteration(
        taskDir,
        `failed:exit-${engineResult.exitCode}`,
        iterStart,
        opts.engine,
        opts.model,
        engineResult.usage,
      );

      if (failure.shouldStop) break;
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

    // Auto-transition using dynamic phase config
    state = autoTransitionAfterIteration(state, taskDir);

    // Push to remote
    try {
      gitPush();
    } catch {
      // Push failures are non-fatal
    }

    // Check STOP signal
    if (checkStopSignal(taskDir)) break;

    log(`\n======== COMPLETED ITERATION ${iteration} ========\n`);

    // Delay between iterations if configured
    if (shouldContinue(state, iteration, opts) && opts.delay > 0) {
      log(`  [wait] Sleeping ${opts.delay}s before next iteration...\n`);
      await sleep(opts.delay);
    }
  }

  log(`Ralph loop finished after ${iteration} iterations.`);

  // Final push
  if (iteration > 0) {
    try {
      gitPush();
    } catch {
      // Push failures are non-fatal
    }
  }
}
