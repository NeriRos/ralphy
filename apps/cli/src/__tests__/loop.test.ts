import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import {
  buildTaskPrompt,
  checkStopCondition,
  checkStopSignal,
  updateStateIteration,
} from "../loop";
import type { LoopOptions } from "../loop";
import { buildInitialState, writeState, readState } from "@ralphy/core/state";
import { runWithContext, createDefaultContext } from "@ralphy/context";
import type { State, Engine } from "@ralphy/types";
import type { BuildInitialStateOpts } from "@ralphy/core/state";

let tempDir: string;
const withStorage = <T>(fn: () => T): T => runWithContext(createDefaultContext(), fn);

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "loop-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function makeState(overrides: Partial<BuildInitialStateOpts> = {}): State {
  return buildInitialState({
    name: "test-task",
    prompt: "Test prompt text",
    ...overrides,
  });
}

describe("buildTaskPrompt", () => {
  test("includes steering content when STEERING.md exists", () =>
    withStorage(() => {
      const state = makeState({ phase: "research" });
      writeState(tempDir, state);
      writeFileSync(join(tempDir, "STEERING.md"), "# Heading\nUse pattern X\nAvoid Y\n", "utf-8");

      const prompt = buildTaskPrompt(state, tempDir);
      expect(prompt).toContain("User Steering");
      expect(prompt).toContain("Use pattern X");
      expect(prompt).toContain("Avoid Y");
      // Headings should be filtered out from steering content
      expect(prompt).not.toContain("# Heading\nUse pattern X");
    }));

  test("omits steering when STEERING.md does not exist", () =>
    withStorage(() => {
      const state = makeState({ phase: "research" });
      writeState(tempDir, state);

      const prompt = buildTaskPrompt(state, tempDir);
      expect(prompt).not.toContain("User Steering");
    }));

  test("omits steering when STEERING.md is empty or only headers", () =>
    withStorage(() => {
      const state = makeState({ phase: "research" });
      writeState(tempDir, state);
      writeFileSync(join(tempDir, "STEERING.md"), "# Title\n## Subtitle\n", "utf-8");

      const prompt = buildTaskPrompt(state, tempDir);
      expect(prompt).not.toContain("User Steering");
    }));

  test("plan phase includes RESEARCH.md content", () =>
    withStorage(() => {
      const state = { ...makeState(), phase: "plan" };
      writeState(tempDir, state);
      writeFileSync(join(tempDir, "RESEARCH.md"), "## Key Findings\nThe API uses REST.\n", "utf-8");

      const prompt = buildTaskPrompt(state, tempDir);
      expect(prompt).toContain("Research Findings");
      expect(prompt).toContain("The API uses REST.");
    }));

  test("exec phase includes current section from PROGRESS.md", () =>
    withStorage(() => {
      const state = { ...makeState(), phase: "exec" };
      writeState(tempDir, state);
      writeFileSync(
        join(tempDir, "PROGRESS.md"),
        [
          "## Section 1 — Setup",
          "- [x] Create config",
          "- [x] Install deps",
          "",
          "## Section 2 — Implementation",
          "- [ ] Add feature A",
          "- [ ] Add feature B",
        ].join("\n"),
        "utf-8",
      );

      const prompt = buildTaskPrompt(state, tempDir);
      expect(prompt).toContain("Section 2");
      expect(prompt).toContain("Add feature A");
      expect(prompt).toContain("Add feature B");
      // Should not include already-completed Section 1
      expect(prompt).not.toContain("Create config");
    }));

  test("review phase includes current section for review", () =>
    withStorage(() => {
      const state = { ...makeState(), phase: "review" };
      writeState(tempDir, state);
      writeFileSync(
        join(tempDir, "PROGRESS.md"),
        ["## Section 1 — Done", "- [x] Item 1", "", "## Section 2 — WIP", "- [ ] Item 2"].join(
          "\n",
        ),
        "utf-8",
      );

      const prompt = buildTaskPrompt(state, tempDir);
      expect(prompt).toContain("Current Section (to review)");
      expect(prompt).toContain("Item 2");
    }));

  test("steering content is limited to 20 lines", () =>
    withStorage(() => {
      const state = makeState({ phase: "research" });
      writeState(tempDir, state);
      const lines = Array.from({ length: 30 }, (_, i) => `Guidance line ${i + 1}`);
      writeFileSync(join(tempDir, "STEERING.md"), lines.join("\n"), "utf-8");

      const prompt = buildTaskPrompt(state, tempDir);
      expect(prompt).toContain("Guidance line 1");
      expect(prompt).toContain("Guidance line 20");
      expect(prompt).not.toContain("Guidance line 21");
    }));
});

describe("MCP tools injection", () => {
  test("includes MCP tools block when engine is claude", () =>
    withStorage(() => {
      const state = makeState({ engine: "claude", phase: "research" });
      writeState(tempDir, state);

      const prompt = buildTaskPrompt(state, tempDir);
      expect(prompt).toContain("MCP Tools Available");
      expect(prompt).toContain("ralph_advance_phase");
      expect(prompt).toContain("ralph_read_document");
      expect(prompt).toContain("ralph_get_task");
      expect(prompt).toContain("Task name: `test-task`");
    }));

  test("omits MCP tools block when engine is codex", () =>
    withStorage(() => {
      const state = { ...makeState({ engine: "codex" as Engine, phase: "research" }) };
      writeState(tempDir, state);

      const prompt = buildTaskPrompt(state, tempDir);
      expect(prompt).not.toContain("MCP Tools Available");
      expect(prompt).not.toContain("ralph_get_task");
    }));

  test("MCP tools block appears in all phases for claude engine", () =>
    withStorage(() => {
      for (const phase of ["research", "plan", "exec", "review"] as const) {
        const state = { ...makeState({ engine: "claude" }), phase };
        writeState(tempDir, state);
        // Add PROGRESS.md for exec/review phases
        if (phase === "exec" || phase === "review") {
          writeFileSync(join(tempDir, "PROGRESS.md"), "## Section 1 — Test\n- [ ] Item\n", "utf-8");
        }

        const prompt = buildTaskPrompt(state, tempDir);
        expect(prompt).toContain("MCP Tools Available");
      }
    }));

  test("template variables are rendered in phase prompts", () =>
    withStorage(() => {
      const state = makeState({ engine: "claude", phase: "research" });
      writeState(tempDir, state);

      const prompt = buildTaskPrompt(state, tempDir);
      // TASK_NAME should be rendered
      expect(prompt).toContain('--name "test-task"');
      // Raw template var should NOT appear
      expect(prompt).not.toContain("{{TASK_NAME}}");
      expect(prompt).not.toContain("{{MCP_TOOLS}}");
      expect(prompt).not.toContain("{{PHASE_ITERATION}}");
    }));
});

describe("parseArgs → buildTaskPrompt integration", () => {
  test("research phase produces non-empty prompt", () =>
    withStorage(() => {
      const state = makeState({ phase: "research" });
      writeState(tempDir, state);

      const prompt = buildTaskPrompt(state, tempDir);
      // Should at minimum have the phase prompt content (if the file exists)
      expect(typeof prompt).toBe("string");
    }));

  test("exec phase with no PROGRESS.md still returns prompt", () =>
    withStorage(() => {
      const state = { ...makeState(), phase: "exec" };
      writeState(tempDir, state);

      const prompt = buildTaskPrompt(state, tempDir);
      expect(typeof prompt).toBe("string");
    }));
});

function makeOpts(overrides: Partial<LoopOptions> = {}): LoopOptions {
  return {
    name: "test-task",
    prompt: "Test prompt",
    engine: "claude",
    model: "opus",
    maxIterations: 0,
    maxCostUsd: 0,
    maxRuntimeMinutes: 0,
    maxConsecutiveFailures: 5,
    noExecute: false,
    interactive: false,
    delay: 0,
    log: false,
    tasksDir: tempDir,
    ...overrides,
  };
}

describe("checkStopCondition", () => {
  test("returns null when no limits are reached", () => {
    const state = makeState({ phase: "research" });
    const result = checkStopCondition(state, 0, makeOpts(), Date.now(), 0);
    expect(result).toBeNull();
  });

  test("returns maxIterations when limit reached", () => {
    const state = makeState({ phase: "research" });
    const result = checkStopCondition(state, 5, makeOpts({ maxIterations: 5 }), Date.now(), 0);
    expect(result).toBe("maxIterations");
  });

  test("returns null when iteration is below maxIterations", () => {
    const state = makeState({ phase: "research" });
    const result = checkStopCondition(state, 4, makeOpts({ maxIterations: 5 }), Date.now(), 0);
    expect(result).toBeNull();
  });

  test("returns terminal when phase is terminal (done)", () => {
    const state = { ...makeState(), phase: "done" };
    const result = checkStopCondition(state, 0, makeOpts(), Date.now(), 0);
    expect(result).toBe("terminal");
  });

  test("returns noExecute when noExecute is true and phase is exec", () => {
    const state = { ...makeState(), phase: "exec" };
    const result = checkStopCondition(state, 0, makeOpts({ noExecute: true }), Date.now(), 0);
    expect(result).toBe("noExecute");
  });

  test("returns null when noExecute is true but phase is not exec", () => {
    const state = makeState({ phase: "research" });
    const result = checkStopCondition(state, 0, makeOpts({ noExecute: true }), Date.now(), 0);
    expect(result).toBeNull();
  });

  test("returns costCap when cost exceeds limit", () => {
    const state = {
      ...makeState(),
      usage: {
        total_cost_usd: 10.5,
        total_duration_ms: 0,
        total_turns: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cache_read_input_tokens: 0,
        total_cache_creation_input_tokens: 0,
      },
    };
    const result = checkStopCondition(state, 0, makeOpts({ maxCostUsd: 10 }), Date.now(), 0);
    expect(result).toBe("costCap");
  });

  test("returns runtimeLimit when elapsed time exceeds limit", () => {
    const state = makeState({ phase: "research" });
    const pastStart = Date.now() - 31 * 60_000; // 31 minutes ago
    const result = checkStopCondition(state, 0, makeOpts({ maxRuntimeMinutes: 30 }), pastStart, 0);
    expect(result).toBe("runtimeLimit");
  });

  test("returns consecutiveFailures when threshold reached", () => {
    const state = makeState({ phase: "research" });
    const result = checkStopCondition(
      state,
      0,
      makeOpts({ maxConsecutiveFailures: 3 }),
      Date.now(),
      3,
    );
    expect(result).toBe("consecutiveFailures");
  });

  test("returns null when consecutiveFailures is below threshold", () => {
    const state = makeState({ phase: "research" });
    const result = checkStopCondition(
      state,
      0,
      makeOpts({ maxConsecutiveFailures: 3 }),
      Date.now(),
      2,
    );
    expect(result).toBeNull();
  });

  test("ignores maxIterations when set to 0 (unlimited)", () => {
    const state = makeState({ phase: "research" });
    const result = checkStopCondition(state, 100, makeOpts({ maxIterations: 0 }), Date.now(), 0);
    expect(result).toBeNull();
  });
});

describe("checkStopSignal", () => {
  test("returns null when no STOP file exists", () =>
    withStorage(() => {
      writeState(tempDir, makeState());
      const result = checkStopSignal(tempDir);
      expect(result).toBeNull();
    }));

  test("returns reason and removes STOP file", () =>
    withStorage(() => {
      writeState(tempDir, makeState());
      writeFileSync(join(tempDir, "STOP"), "Blocked: need API key", "utf-8");

      const result = checkStopSignal(tempDir);
      expect(result).toBe("Blocked: need API key");

      // File should be removed
      const { existsSync } = require("node:fs");
      expect(existsSync(join(tempDir, "STOP"))).toBe(false);
    }));

  test("marks state as blocked after reading STOP", () =>
    withStorage(() => {
      writeState(tempDir, makeState());
      writeFileSync(join(tempDir, "STOP"), "reason", "utf-8");

      checkStopSignal(tempDir);

      const state = readState(tempDir);
      expect(state.status).toBe("blocked");
    }));
});

describe("updateStateIteration", () => {
  test("increments phaseIteration and totalIterations", () =>
    withStorage(() => {
      writeState(tempDir, makeState());

      const updated = updateStateIteration(
        tempDir,
        "success",
        new Date().toISOString(),
        "claude",
        "opus",
        null,
      );
      expect(updated.phaseIteration).toBe(1);
      expect(updated.totalIterations).toBe(1);
    }));

  test("appends history entry", () =>
    withStorage(() => {
      writeState(tempDir, makeState());

      const startedAt = new Date().toISOString();
      const updated = updateStateIteration(tempDir, "success", startedAt, "claude", "opus", null);
      expect(updated.history).toHaveLength(1);
      expect(updated.history[0]!.result).toBe("success");
      expect(updated.history[0]!.engine).toBe("claude");
      expect(updated.history[0]!.model).toBe("opus");
    }));

  test("accumulates usage when provided", () =>
    withStorage(() => {
      writeState(tempDir, makeState());

      const usage = {
        cost_usd: 0.5,
        duration_ms: 3000,
        num_turns: 2,
        input_tokens: 1000,
        output_tokens: 500,
        cache_read_input_tokens: 100,
        cache_creation_input_tokens: 50,
      };
      const updated = updateStateIteration(
        tempDir,
        "success",
        new Date().toISOString(),
        "claude",
        "opus",
        usage,
      );
      expect(updated.usage.total_cost_usd).toBe(0.5);
      expect(updated.usage.total_input_tokens).toBe(1000);
      expect(updated.usage.total_output_tokens).toBe(500);
    }));

  test("does not change usage when none provided", () =>
    withStorage(() => {
      writeState(tempDir, makeState());

      const updated = updateStateIteration(
        tempDir,
        "success",
        new Date().toISOString(),
        "claude",
        "opus",
        null,
      );
      expect(updated.usage.total_cost_usd).toBe(0);
      expect(updated.usage.total_input_tokens).toBe(0);
    }));
});
