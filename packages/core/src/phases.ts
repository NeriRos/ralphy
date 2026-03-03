import { join } from "node:path";
import { type State, type Phase } from "@ralphy/types";
import { writeState } from "./state";
import { countProgress } from "./progress";
import { resolveChecklistDir, listChecklists } from "./templates";
import { getStorage } from "@ralphy/context";

/**
 * Infer the current phase from files present in a task directory.
 */
export function inferPhaseFromFiles(taskDir: string): Phase {
  const storage = getStorage();
  if (storage.read(join(taskDir, "RESEARCH.md")) === null) return "research";

  const plan = storage.read(join(taskDir, "PLAN.md"));
  const progress = storage.read(join(taskDir, "PROGRESS.md"));
  if (plan === null || progress === null) return "plan";

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

  const storage = getStorage();

  switch (current) {
    case "research": {
      if (storage.read(join(taskDir, "RESEARCH.md")) === null) {
        throw new Error("Cannot advance from research — RESEARCH.md does not exist yet");
      }
      return recordPhaseTransition(state, "research", "plan");
    }

    case "plan": {
      const plan = storage.read(join(taskDir, "PLAN.md"));
      let progressContent = storage.read(join(taskDir, "PROGRESS.md"));
      if (plan === null || progressContent === null) {
        throw new Error("Cannot advance from plan — PLAN.md and PROGRESS.md must both exist");
      }
      const { unchecked } = countProgress(progressContent);
      if (unchecked === 0) {
        throw new Error("Cannot advance to exec — PROGRESS.md has no unchecked items");
      }

      // Auto-append checklists as final sections of PROGRESS.md
      progressContent = appendChecklists(progressContent);
      storage.write(join(taskDir, "PROGRESS.md"), progressContent);

      return recordPhaseTransition(state, "plan", "exec");
    }

    case "exec": {
      return recordPhaseTransition(state, "exec", "review");
    }

    case "review": {
      const progress = storage.read(join(taskDir, "PROGRESS.md")) ?? "";
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
  const progress = getStorage().read(join(taskDir, "PROGRESS.md"));
  if (progress === null) return state;

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
  const progress = getStorage().read(join(taskDir, "PROGRESS.md"));
  if (progress === null) return state;

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

/**
 * Append all checklists from templates/checklists/ as new numbered sections
 * at the end of PROGRESS.md content. Titles are extracted from each file's H1 heading.
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
