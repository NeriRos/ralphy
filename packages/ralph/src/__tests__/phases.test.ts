import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  inferPhaseFromFiles,
  recordPhaseTransition,
  advancePhase,
  setPhase,
  autoTransitionAfterExec,
  autoTransitionAfterReview,
} from "../phases";
import { buildInitialState, writeState, readState } from "../state";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import type { State } from "../types";

let tempDir: string;

function makeState(overrides: Partial<State> = {}): State {
  const base = buildInitialState({ name: "test", prompt: "p" });
  return { ...base, ...overrides };
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "ralph-phases-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("inferPhaseFromFiles", () => {
  test("returns research when no files exist", () => {
    expect(inferPhaseFromFiles(tempDir)).toBe("research");
  });

  test("returns plan when only RESEARCH.md exists", () => {
    writeFileSync(join(tempDir, "RESEARCH.md"), "# Research", "utf-8");
    expect(inferPhaseFromFiles(tempDir)).toBe("plan");
  });

  test("returns plan when PLAN.md exists but not PROGRESS.md", () => {
    writeFileSync(join(tempDir, "RESEARCH.md"), "# Research", "utf-8");
    writeFileSync(join(tempDir, "PLAN.md"), "# Plan", "utf-8");
    expect(inferPhaseFromFiles(tempDir)).toBe("plan");
  });

  test("returns exec when PROGRESS.md has unchecked items", () => {
    writeFileSync(join(tempDir, "RESEARCH.md"), "# Research", "utf-8");
    writeFileSync(join(tempDir, "PLAN.md"), "# Plan", "utf-8");
    writeFileSync(
      join(tempDir, "PROGRESS.md"),
      "## Section 1\n- [x] Done\n- [ ] Todo\n",
      "utf-8",
    );
    expect(inferPhaseFromFiles(tempDir)).toBe("exec");
  });

  test("returns done when all items are checked", () => {
    writeFileSync(join(tempDir, "RESEARCH.md"), "# Research", "utf-8");
    writeFileSync(join(tempDir, "PLAN.md"), "# Plan", "utf-8");
    writeFileSync(
      join(tempDir, "PROGRESS.md"),
      "## Section 1\n- [x] Done\n- [x] Also done\n",
      "utf-8",
    );
    expect(inferPhaseFromFiles(tempDir)).toBe("done");
  });
});

describe("recordPhaseTransition", () => {
  test("updates phase and resets iteration counter", () => {
    const state = makeState({ phase: "research", phaseIteration: 3 });
    const updated = recordPhaseTransition(state, "research", "plan");
    expect(updated.phase).toBe("plan");
    expect(updated.phaseIteration).toBe(0);
  });

  test("appends history entry with default result message", () => {
    const state = makeState({ phase: "research" });
    const updated = recordPhaseTransition(state, "research", "plan");
    expect(updated.history).toHaveLength(1);
    expect(updated.history[0].phase).toBe("research");
    expect(updated.history[0].result).toBe("advance -> plan");
  });

  test("uses custom result message when provided", () => {
    const state = makeState({ phase: "exec" });
    const updated = recordPhaseTransition(
      state,
      "exec",
      "review",
      "custom reason",
    );
    expect(updated.history[0].result).toBe("custom reason");
  });

  test("preserves existing history entries", () => {
    const state = makeState({
      phase: "plan",
      history: [
        {
          timestamp: "2026-01-01T00:00:00Z",
          phase: "research",
          iteration: 0,
          engine: "claude",
          model: "opus",
          result: "advance -> plan",
        },
      ],
    });
    const updated = recordPhaseTransition(state, "plan", "exec");
    expect(updated.history).toHaveLength(2);
    expect(updated.history[0].result).toBe("advance -> plan");
    expect(updated.history[1].result).toBe("advance -> exec");
  });
});

describe("advancePhase", () => {
  test("research → plan when RESEARCH.md exists", () => {
    writeFileSync(join(tempDir, "RESEARCH.md"), "# Research", "utf-8");
    const state = makeState({ phase: "research" });
    const updated = advancePhase(state, tempDir);
    expect(updated.phase).toBe("plan");
  });

  test("research → throws when RESEARCH.md missing", () => {
    const state = makeState({ phase: "research" });
    expect(() => advancePhase(state, tempDir)).toThrow("RESEARCH.md");
  });

  test("plan → exec when PLAN.md and PROGRESS.md exist with unchecked items", () => {
    writeFileSync(join(tempDir, "PLAN.md"), "# Plan", "utf-8");
    writeFileSync(
      join(tempDir, "PROGRESS.md"),
      "## S1\n- [ ] Todo\n",
      "utf-8",
    );
    const state = makeState({ phase: "plan" });
    const updated = advancePhase(state, tempDir);
    expect(updated.phase).toBe("exec");
  });

  test("plan → throws when PLAN.md missing", () => {
    writeFileSync(
      join(tempDir, "PROGRESS.md"),
      "## S1\n- [ ] Todo\n",
      "utf-8",
    );
    const state = makeState({ phase: "plan" });
    expect(() => advancePhase(state, tempDir)).toThrow("PLAN.md");
  });

  test("plan → throws when PROGRESS.md missing", () => {
    writeFileSync(join(tempDir, "PLAN.md"), "# Plan", "utf-8");
    const state = makeState({ phase: "plan" });
    expect(() => advancePhase(state, tempDir)).toThrow("PROGRESS.md");
  });

  test("plan → throws when PROGRESS.md has no unchecked items", () => {
    writeFileSync(join(tempDir, "PLAN.md"), "# Plan", "utf-8");
    writeFileSync(
      join(tempDir, "PROGRESS.md"),
      "## S1\n- [x] Done\n",
      "utf-8",
    );
    const state = makeState({ phase: "plan" });
    expect(() => advancePhase(state, tempDir)).toThrow("no unchecked items");
  });

  test("exec → review", () => {
    const state = makeState({ phase: "exec" });
    const updated = advancePhase(state, tempDir);
    expect(updated.phase).toBe("review");
  });

  test("review → exec when issues found", () => {
    writeFileSync(
      join(tempDir, "PROGRESS.md"),
      "## S1\n- [x] Item — ⚠️ Issue: bug\n- [ ] Todo\n",
      "utf-8",
    );
    const state = makeState({ phase: "review" });
    const updated = advancePhase(state, tempDir);
    expect(updated.phase).toBe("exec");
    expect(updated.history[0].result).toContain("issues found");
  });

  test("review → done when no issues and all items checked", () => {
    writeFileSync(
      join(tempDir, "PROGRESS.md"),
      "## S1\n- [x] Done\n- [x] Also done\n",
      "utf-8",
    );
    const state = makeState({ phase: "review" });
    const updated = advancePhase(state, tempDir);
    expect(updated.phase).toBe("done");
    expect(updated.status).toBe("completed");
  });

  test("review → exec when no issues but unchecked items remain", () => {
    writeFileSync(
      join(tempDir, "PROGRESS.md"),
      "## S1\n- [x] Done\n- [ ] Todo\n",
      "utf-8",
    );
    const state = makeState({ phase: "review" });
    const updated = advancePhase(state, tempDir);
    expect(updated.phase).toBe("exec");
    expect(updated.history[0].result).toContain("next section");
  });

  test("done → throws", () => {
    const state = makeState({ phase: "done" });
    expect(() => advancePhase(state, tempDir)).toThrow("already done");
  });
});

describe("setPhase", () => {
  test("sets phase directly and persists to disk", () => {
    const state = makeState({ phase: "research" });
    writeState(tempDir, state);
    const updated = setPhase(state, tempDir, "exec");
    expect(updated.phase).toBe("exec");
    expect(updated.history[0].result).toBe("set-phase: research -> exec");

    const persisted = readState(tempDir);
    expect(persisted.phase).toBe("exec");
  });
});

describe("autoTransitionAfterExec", () => {
  test("stays in exec when unchecked items remain", () => {
    writeFileSync(
      join(tempDir, "PROGRESS.md"),
      "## S1\n- [x] Done\n- [ ] Todo\n",
      "utf-8",
    );
    const state = makeState({ phase: "exec" });
    writeState(tempDir, state);
    const updated = autoTransitionAfterExec(state, tempDir);
    expect(updated.phase).toBe("exec");
    expect(updated.history).toHaveLength(0);
  });

  test("advances to review when all items checked", () => {
    writeFileSync(
      join(tempDir, "PROGRESS.md"),
      "## S1\n- [x] Done\n- [x] Also done\n",
      "utf-8",
    );
    const state = makeState({ phase: "exec" });
    writeState(tempDir, state);
    const updated = autoTransitionAfterExec(state, tempDir);
    expect(updated.phase).toBe("review");

    const persisted = readState(tempDir);
    expect(persisted.phase).toBe("review");
  });

  test("returns state unchanged when PROGRESS.md missing", () => {
    const state = makeState({ phase: "exec" });
    const updated = autoTransitionAfterExec(state, tempDir);
    expect(updated.phase).toBe("exec");
  });
});

describe("autoTransitionAfterReview", () => {
  test("loops back to exec when issues found", () => {
    writeFileSync(
      join(tempDir, "PROGRESS.md"),
      "## S1\n- [x] Item — ⚠️ Issue: bug\n- [ ] Todo\n",
      "utf-8",
    );
    const state = makeState({ phase: "review" });
    writeState(tempDir, state);
    const updated = autoTransitionAfterReview(state, tempDir);
    expect(updated.phase).toBe("exec");
    expect(updated.history[0].result).toContain("issues found");
  });

  test("advances to done when no issues and all items checked", () => {
    writeFileSync(
      join(tempDir, "PROGRESS.md"),
      "## S1\n- [x] Done\n- [x] Also done\n",
      "utf-8",
    );
    const state = makeState({ phase: "review" });
    writeState(tempDir, state);
    const updated = autoTransitionAfterReview(state, tempDir);
    expect(updated.phase).toBe("done");
    expect(updated.status).toBe("completed");

    const persisted = readState(tempDir);
    expect(persisted.phase).toBe("done");
    expect(persisted.status).toBe("completed");
  });

  test("advances to exec when no issues but unchecked items remain", () => {
    writeFileSync(
      join(tempDir, "PROGRESS.md"),
      "## S1\n- [x] Done\n- [ ] Todo\n",
      "utf-8",
    );
    const state = makeState({ phase: "review" });
    writeState(tempDir, state);
    const updated = autoTransitionAfterReview(state, tempDir);
    expect(updated.phase).toBe("exec");
    expect(updated.history[0].result).toContain("next section");
  });

  test("returns state unchanged when PROGRESS.md missing", () => {
    const state = makeState({ phase: "review" });
    const updated = autoTransitionAfterReview(state, tempDir);
    expect(updated.phase).toBe("review");
  });
});
