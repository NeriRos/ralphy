import { join } from "node:path";
import type { State } from "@ralphy/types";
import { getPhase, getNextPhase, loadPhases } from "@ralphy/phases";
import { writeState } from "./state";
import { countProgress } from "./progress";
import { resolveChecklistDir, listChecklists } from "./templates";
import { getStorage } from "@ralphy/context";

/**
 * Infer the current phase from files present in a task directory.
 */
export function inferPhaseFromFiles(taskDir: string): string {
  const storage = getStorage();
  const phases = loadPhases();

  // Walk phases in order; the first whose `requires` are not all met is the answer.
  for (const phase of phases) {
    if (phase.terminal) continue;
    const missing = phase.requires.some((f) => storage.read(join(taskDir, f)) === null);
    if (missing) {
      // Find the previous phase (the one before this one that would produce the required files)
      const idx = phases.indexOf(phase);
      if (idx > 0) return phases[idx - 1]!.name;
      return phases[0]!.name;
    }
  }

  // All requires met — check if progress items remain
  const progress = storage.read(join(taskDir, "PROGRESS.md"));
  if (progress) {
    const { unchecked } = countProgress(progress);
    if (unchecked === 0) {
      const terminal = phases.find((p) => p.terminal);
      return terminal?.name ?? "done";
    }
  }

  // Default to exec if all files present but items remain
  return phases.find((p) => p.name === "exec")?.name ?? phases[phases.length - 1]!.name;
}

/**
 * Record a phase transition in state history and update the phase.
 */
export function recordPhaseTransition(
  state: State,
  from: string,
  to: string,
  result?: string,
): State {
  const now = new Date().toISOString();
  return {
    ...state,
    phase: to,
    phaseIteration: 0,
    lastModified: now,
    history: [
      ...state.history,
      {
        timestamp: now,
        phase: from,
        iteration: state.phaseIteration,
        engine: state.engine,
        model: state.model,
        result: result ?? `advance -> ${to}`,
      },
    ],
  };
}

/**
 * Advance to the next phase. Validates that required files exist before advancing.
 * Uses dynamic phase configs for all transition logic.
 */
export function advancePhase(state: State, taskDir: string): State {
  const current = state.phase;
  const config = getPhase(current);
  const storage = getStorage();

  if (config.terminal) {
    throw new Error("Task is already done. Nothing to advance.");
  }

  // Handle loopBack phases (e.g. review) — these have special transition logic
  // and skip requires validation since the target already had its files created earlier
  if (config.loopBack) {
    const progress = storage.read(join(taskDir, "PROGRESS.md")) ?? "";
    const hasIssues = /⚠️/.test(progress);
    if (hasIssues) {
      return recordPhaseTransition(state, current, config.loopBack, "issues found -> loop back");
    }
    const { unchecked } = countProgress(progress);
    if (unchecked === 0) {
      const terminal = loadPhases().find((p) => p.terminal);
      if (terminal) {
        const updated = recordPhaseTransition(
          state,
          current,
          terminal.name,
          "no issues found -> advance to done",
        );
        return { ...updated, status: "completed" };
      }
    }
    const nextName = getNextPhase(current);
    if (!nextName) throw new Error(`No next phase after ${current}`);
    return recordPhaseTransition(
      state,
      current,
      nextName,
      "no issues found -> advance to next section",
    );
  }

  // Resolve the target phase
  const nextName = getNextPhase(current);
  if (!nextName) {
    throw new Error(`No next phase after ${current}`);
  }

  const nextConfig = getPhase(nextName);

  // Validate requires for the target phase
  for (const file of nextConfig.requires) {
    if (storage.read(join(taskDir, file)) === null) {
      throw new Error(`Cannot advance to ${nextName} — ${file} does not exist yet`);
    }
  }

  // Special handling: when advancing from plan to exec, validate progress has items and append checklists
  if (nextName === "exec" && current === "plan") {
    let progressContent = storage.read(join(taskDir, "PROGRESS.md"));
    if (progressContent !== null) {
      const { unchecked } = countProgress(progressContent);
      if (unchecked === 0) {
        throw new Error("Cannot advance to exec — PROGRESS.md has no unchecked items");
      }
      progressContent = appendChecklists(progressContent);
      storage.write(join(taskDir, "PROGRESS.md"), progressContent);
    }
  }

  return recordPhaseTransition(state, current, nextName);
}

/**
 * Set the phase directly, bypassing validation.
 */
export function setPhase(state: State, taskDir: string, targetPhase: string): State {
  const from = state.phase;
  const updated = recordPhaseTransition(
    state,
    from,
    targetPhase,
    `set-phase: ${from} -> ${targetPhase}`,
  );
  writeState(taskDir, updated);
  return updated;
}

/**
 * Generic auto-transition after any iteration.
 * Uses phase config to determine behavior:
 * - If `loopBack` is set and issues found → transition to loopBack phase
 * - If `autoAdvance === "allChecked"` and all items checked → advance
 * - Otherwise stay in current phase
 */
export function autoTransitionAfterIteration(state: State, taskDir: string): State {
  const config = getPhase(state.phase);
  const storage = getStorage();
  const progress = storage.read(join(taskDir, "PROGRESS.md"));
  if (progress === null) return state;

  // Check for loopBack (issues found)
  if (config.loopBack) {
    const hasIssues = /⚠️/.test(progress);
    if (hasIssues) {
      const updated = recordPhaseTransition(
        state,
        state.phase,
        config.loopBack,
        "issues found -> loop back",
      );
      writeState(taskDir, updated);
      return updated;
    }
  }

  // Check for autoAdvance
  if (config.autoAdvance === "allChecked") {
    const { unchecked } = countProgress(progress);
    if (unchecked === 0) {
      // If loopBack is set (review phase), go to terminal when all checked
      if (config.loopBack) {
        const terminal = loadPhases().find((p) => p.terminal);
        if (terminal) {
          const updated = recordPhaseTransition(
            state,
            state.phase,
            terminal.name,
            "all items checked -> advance to done",
          );
          const final = { ...updated, status: "completed" };
          writeState(taskDir, final);
          return final;
        }
      }

      // Otherwise advance to next phase
      const nextName = getNextPhase(state.phase);
      if (nextName) {
        const updated = recordPhaseTransition(
          state,
          state.phase,
          nextName,
          "all items checked -> auto-advance",
        );
        writeState(taskDir, updated);
        return updated;
      }
    }
  }

  // No loopBack and review-style phase: check for next section advancement
  if (config.loopBack && config.autoAdvance === "allChecked") {
    const { unchecked } = countProgress(progress);
    if (unchecked > 0) {
      // Still items remaining, advance to next (exec) for the next section
      const nextName = getNextPhase(state.phase);
      if (nextName) {
        const updated = recordPhaseTransition(
          state,
          state.phase,
          nextName,
          "no issues found -> advance to next section",
        );
        writeState(taskDir, updated);
        return updated;
      }
    }
  }

  return state;
}

/**
 * Append all checklists from templates/checklists/ as new numbered sections
 * at the end of PROGRESS.md content.
 */
function appendChecklists(progress: string): string {
  const storage = getStorage();
  const dir = resolveChecklistDir();
  const names = listChecklists();

  const sectionMatches = progress.match(/^## Section \d+/gm);
  let nextSection = (sectionMatches?.length ?? 0) + 1;

  for (const name of names) {
    const raw = storage.read(join(dir, `${name}.md`));
    if (raw === null) continue;

    const h1Match = raw.match(/^# (.+)\n/);
    const title = h1Match ? h1Match[1]! : "Checklist";
    const body = h1Match ? raw.slice(h1Match[0].length).replace(/^\n+/, "") : raw;

    progress += `\n## Section ${nextSection} — ${title}\n\n${body.trimEnd()}\n`;
    nextSection++;
  }

  return progress;
}
