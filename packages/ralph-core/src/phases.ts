import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { type State, type Phase } from "ralph-types";
import { writeState } from "./state";
import { countProgress } from "./progress";

/**
 * Infer the current phase from files present in a task directory.
 */
export function inferPhaseFromFiles(taskDir: string): Phase {
  if (!existsSync(join(taskDir, "RESEARCH.md"))) return "research";
  if (!existsSync(join(taskDir, "PLAN.md")) || !existsSync(join(taskDir, "PROGRESS.md")))
    return "plan";

  const progress = readFileSync(join(taskDir, "PROGRESS.md"), "utf-8");
  const { unchecked } = countProgress(progress);
  return unchecked === 0 ? "done" : "exec";
}

/**
 * Record a phase transition in state history and update the phase.
 */
export function recordPhaseTransition(
  state: State,
  from: Phase,
  to: Phase,
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
 * Advance to the next phase in the sequence: research → plan → exec.
 * Validates that required files exist before advancing.
 * Throws if advancement is not possible.
 */
export function advancePhase(state: State, taskDir: string): State {
  const current = state.phase as Phase;

  switch (current) {
    case "research": {
      if (!existsSync(join(taskDir, "RESEARCH.md"))) {
        throw new Error("Cannot advance from research — RESEARCH.md does not exist yet");
      }
      return recordPhaseTransition(state, "research", "plan");
    }

    case "plan": {
      if (!existsSync(join(taskDir, "PLAN.md")) || !existsSync(join(taskDir, "PROGRESS.md"))) {
        throw new Error("Cannot advance from plan — PLAN.md and PROGRESS.md must both exist");
      }
      const progress = readFileSync(join(taskDir, "PROGRESS.md"), "utf-8");
      const { unchecked } = countProgress(progress);
      if (unchecked === 0) {
        throw new Error("Cannot advance to exec — PROGRESS.md has no unchecked items");
      }
      return recordPhaseTransition(state, "plan", "exec");
    }

    case "exec": {
      return recordPhaseTransition(state, "exec", "review");
    }

    case "review": {
      const progress = readFileSync(join(taskDir, "PROGRESS.md"), "utf-8");
      const hasIssues = /⚠️/.test(progress);
      if (hasIssues) {
        return recordPhaseTransition(state, "review", "exec", "issues found -> loop back to exec");
      }
      const { unchecked } = countProgress(progress);
      if (unchecked === 0) {
        const updated = recordPhaseTransition(
          state,
          "review",
          "done",
          "no issues found -> advance to done",
        );
        return { ...updated, status: "completed" };
      }
      return recordPhaseTransition(
        state,
        "review",
        "exec",
        "no issues found -> advance to next section",
      );
    }

    case "done":
      throw new Error("Task is already done. Nothing to advance.");

    default:
      throw new Error(`Unknown phase: ${current}`);
  }
}

/**
 * Set the phase directly, bypassing validation.
 */
export function setPhase(state: State, taskDir: string, targetPhase: Phase): State {
  const from = state.phase as Phase;
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
 * Auto-transition after an exec iteration.
 * If all items are checked, advance to review. Otherwise stay in exec.
 */
export function autoTransitionAfterExec(state: State, taskDir: string): State {
  if (!existsSync(join(taskDir, "PROGRESS.md"))) return state;

  const progress = readFileSync(join(taskDir, "PROGRESS.md"), "utf-8");
  const { unchecked } = countProgress(progress);

  if (unchecked > 0) {
    return state;
  }

  const updated = recordPhaseTransition(
    state,
    "exec",
    "review",
    "all items checked -> auto-advance to review",
  );
  writeState(taskDir, updated);
  return updated;
}

/**
 * Auto-transition after a review iteration.
 * - If issues found (⚠️ markers): loop back to exec
 * - If no issues and all items checked: advance to done
 * - If no issues but unchecked items remain: advance to exec (next section)
 */
export function autoTransitionAfterReview(state: State, taskDir: string): State {
  if (!existsSync(join(taskDir, "PROGRESS.md"))) return state;

  const progress = readFileSync(join(taskDir, "PROGRESS.md"), "utf-8");
  const hasIssues = /⚠️/.test(progress);

  if (hasIssues) {
    const updated = recordPhaseTransition(
      state,
      "review",
      "exec",
      "issues found -> loop back to exec",
    );
    writeState(taskDir, updated);
    return updated;
  }

  const { unchecked } = countProgress(progress);

  if (unchecked === 0) {
    const updated = recordPhaseTransition(
      state,
      "review",
      "done",
      "no issues found -> advance to done",
    );
    const final = { ...updated, status: "completed" };
    writeState(taskDir, final);
    return final;
  }

  const updated = recordPhaseTransition(
    state,
    "review",
    "exec",
    "no issues found -> advance to next section",
  );
  writeState(taskDir, updated);
  return updated;
}
