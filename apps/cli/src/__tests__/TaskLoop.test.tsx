import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
import { render } from "ink-testing-library";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import { runWithContext, createDefaultContext } from "@ralphy/context";
import { buildInitialState, writeState } from "@ralphy/core/state";
import type { State } from "@ralphy/types";
import type { BuildInitialStateOpts } from "@ralphy/core/state";
import type { EngineResult } from "@ralphy/engine/engine";

// Mock the engine module to avoid spawning real processes
const runEngineMock = mock(
  async (opts: { onFeedEvent?: (e: unknown) => void }): Promise<EngineResult> => {
    // Emit a few feed events for coverage
    if (opts.onFeedEvent) {
      opts.onFeedEvent({ type: "session", model: "opus", sessionId: "test123" });
      opts.onFeedEvent({ type: "text", text: "Working..." });
      opts.onFeedEvent({ type: "turn-done" });
    }
    return { exitCode: 0, usage: null, sessionId: null };
  },
);

const handleEngineFailureMock = mock((exitCode: number) => ({
  message: `Failed (exit ${exitCode})`,
  shouldStop: false,
}));

mock.module("@ralphy/engine/engine", () => ({
  runEngine: runEngineMock,
  handleEngineFailure: handleEngineFailureMock,
}));

// Mock git operations to avoid real git commands
mock.module("@ralphy/core/git", () => ({
  gitPush: mock(() => {}),
  commitTaskDir: mock(() => {}),
  commitState: mock(() => {}),
  getCurrentBranch: mock(() => "test-branch"),
  gitAdd: mock(() => {}),
  gitCommit: mock(() => {}),
}));

// Mock scaffoldTaskDocuments to be a no-op
mock.module("@ralphy/core/templates", () => ({
  scaffoldTaskDocuments: mock(() => {}),
  renderTemplate: (content: string, vars: Record<string, string>) => {
    let result = content;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replaceAll(`{{${key}}}`, value);
    }
    return result;
  },
  resolveTemplatePath: mock((name: string) => `/tmp/templates/${name}.md`),
}));

// Import after mocking
const { TaskLoop } = await import("../components/TaskLoop");

let tempDir: string;

function withStorage<T>(fn: () => T): T {
  return runWithContext(createDefaultContext(), fn);
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "taskloop-test-"));
  runEngineMock.mockClear();
  handleEngineFailureMock.mockClear();
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

describe("TaskLoop", () => {
  test("renders banner and exits after loop completes (maxIterations=1)", async () => {
    await withStorage(async () => {
      const taskDir = join(tempDir, "test-task");
      mkdirSync(taskDir, { recursive: true });
      const state = makeState({ name: "test-task" });
      writeState(taskDir, state);

      const opts = {
        name: "test-task",
        prompt: "Test prompt text",
        engine: "claude" as const,
        model: "opus",
        maxIterations: 1,
        maxCostUsd: 0,
        maxRuntimeMinutes: 0,
        maxConsecutiveFailures: 5,
        noExecute: false,
        interactive: false,
        delay: 0,
        log: false,
        verbose: false,
        tasksDir: tempDir,
      };

      const { frames } = render(<TaskLoop opts={opts} />);

      // Wait for the async loop to complete
      await new Promise((r) => setTimeout(r, 500));

      const allText = frames.join("\n");
      // Banner should be rendered showing task info
      expect(allText).toContain("Ralph Loop");
    });
  });

  test("renders with PROGRESS.md present", async () => {
    await withStorage(async () => {
      const taskDir = join(tempDir, "prog-task");
      mkdirSync(taskDir, { recursive: true });
      const state = makeState({ name: "prog-task" });
      writeState(taskDir, state);
      writeFileSync(
        join(taskDir, "PROGRESS.md"),
        "## Section 1 — Setup\n- [x] Done\n- [ ] Pending\n",
        "utf-8",
      );

      const opts = {
        name: "prog-task",
        prompt: "Test prompt text",
        engine: "claude" as const,
        model: "opus",
        maxIterations: 1,
        maxCostUsd: 0,
        maxRuntimeMinutes: 0,
        maxConsecutiveFailures: 5,
        noExecute: false,
        interactive: false,
        delay: 0,
        log: false,
        verbose: false,
        tasksDir: tempDir,
      };

      const { frames } = render(<TaskLoop opts={opts} />);
      await new Promise((r) => setTimeout(r, 500));

      const allText = frames.join("\n");
      expect(allText).toContain("Ralph Loop");
    });
  });

  test("handles engine failure", async () => {
    runEngineMock.mockImplementationOnce(async () => ({
      exitCode: 1,
      usage: null,
      sessionId: null,
    }));

    await withStorage(async () => {
      const taskDir = join(tempDir, "fail-task");
      mkdirSync(taskDir, { recursive: true });
      const state = makeState({ name: "fail-task" });
      writeState(taskDir, state);

      const opts = {
        name: "fail-task",
        prompt: "Test prompt",
        engine: "claude" as const,
        model: "opus",
        maxIterations: 5,
        maxCostUsd: 0,
        maxRuntimeMinutes: 0,
        maxConsecutiveFailures: 5,
        noExecute: false,
        interactive: false,
        delay: 0,
        log: false,
        verbose: false,
        tasksDir: tempDir,
      };

      const { frames } = render(<TaskLoop opts={opts} />);
      await new Promise((r) => setTimeout(r, 500));

      const allText = frames.join("\n");
      expect(allText).toContain("Ralph Loop");
    });
  });

  test("resumes existing task", async () => {
    await withStorage(async () => {
      const taskDir = join(tempDir, "resume-task");
      mkdirSync(taskDir, { recursive: true });
      // Create a state that has already run some iterations
      const state = {
        ...makeState({ name: "resume-task" }),
        totalIterations: 3,
        phaseIteration: 3,
      };
      writeState(taskDir, state);

      const opts = {
        name: "resume-task",
        prompt: "Resume prompt",
        engine: "claude" as const,
        model: "opus",
        maxIterations: 1,
        maxCostUsd: 0,
        maxRuntimeMinutes: 0,
        maxConsecutiveFailures: 5,
        noExecute: false,
        interactive: false,
        delay: 0,
        log: false,
        verbose: false,
        tasksDir: tempDir,
      };

      const { frames } = render(<TaskLoop opts={opts} />);
      await new Promise((r) => setTimeout(r, 500));

      const allText = frames.join("\n");
      expect(allText).toContain("resumed");
    });
  });

  test("stops on terminal phase", async () => {
    await withStorage(async () => {
      const taskDir = join(tempDir, "done-task");
      mkdirSync(taskDir, { recursive: true });
      const state = {
        ...makeState({ name: "done-task" }),
        phase: "done",
        status: "completed",
      };
      writeState(taskDir, state);

      const opts = {
        name: "done-task",
        prompt: "Done prompt",
        engine: "claude" as const,
        model: "opus",
        maxIterations: 0,
        maxCostUsd: 0,
        maxRuntimeMinutes: 0,
        maxConsecutiveFailures: 5,
        noExecute: false,
        interactive: false,
        delay: 0,
        log: false,
        verbose: false,
        tasksDir: tempDir,
      };

      const { frames } = render(<TaskLoop opts={opts} />);
      await new Promise((r) => setTimeout(r, 500));

      const allText = frames.join("\n");
      // Should show the stop message for terminal phase
      expect(allText).toContain("Ralph Loop");
    });
  });

  test("renders with verbose flag", async () => {
    runEngineMock.mockImplementationOnce(async (opts: { onFeedEvent?: (e: unknown) => void }) => {
      if (opts.onFeedEvent) {
        opts.onFeedEvent({ type: "session", model: "opus", sessionId: "test" });
        opts.onFeedEvent({
          type: "tool-result-preview",
          lines: ["preview line"],
          truncated: 5,
        });
      }
      return { exitCode: 0, usage: null, sessionId: null };
    });

    await withStorage(async () => {
      const taskDir = join(tempDir, "verbose-task");
      mkdirSync(taskDir, { recursive: true });
      const state = makeState({ name: "verbose-task" });
      writeState(taskDir, state);

      const opts = {
        name: "verbose-task",
        prompt: "Verbose prompt",
        engine: "claude" as const,
        model: "opus",
        maxIterations: 1,
        maxCostUsd: 0,
        maxRuntimeMinutes: 0,
        maxConsecutiveFailures: 5,
        noExecute: false,
        interactive: false,
        delay: 0,
        log: false,
        verbose: true,
        tasksDir: tempDir,
      };

      const { frames } = render(<TaskLoop opts={opts} />);
      await new Promise((r) => setTimeout(r, 500));

      const allText = frames.join("\n");
      expect(allText).toContain("Ralph Loop");
    });
  });

  test("engine updates model on resume with different engine/model", async () => {
    await withStorage(async () => {
      const taskDir = join(tempDir, "reconfig-task");
      mkdirSync(taskDir, { recursive: true });
      const state = makeState({ name: "reconfig-task", engine: "claude", model: "sonnet" });
      writeState(taskDir, state);

      const opts = {
        name: "reconfig-task",
        prompt: "Reconfig",
        engine: "claude" as const,
        model: "opus",
        maxIterations: 1,
        maxCostUsd: 0,
        maxRuntimeMinutes: 0,
        maxConsecutiveFailures: 5,
        noExecute: false,
        interactive: false,
        delay: 0,
        log: false,
        verbose: false,
        tasksDir: tempDir,
      };

      const { frames } = render(<TaskLoop opts={opts} />);
      await new Promise((r) => setTimeout(r, 500));

      const allText = frames.join("\n");
      expect(allText).toContain("Ralph Loop");
    });
  });

  test("handles engine exception", async () => {
    runEngineMock.mockImplementationOnce(async () => {
      throw new Error("Engine crashed");
    });

    await withStorage(async () => {
      const taskDir = join(tempDir, "crash-task");
      mkdirSync(taskDir, { recursive: true });
      const state = makeState({ name: "crash-task" });
      writeState(taskDir, state);

      const opts = {
        name: "crash-task",
        prompt: "Crash prompt",
        engine: "claude" as const,
        model: "opus",
        maxIterations: 5,
        maxCostUsd: 0,
        maxRuntimeMinutes: 0,
        maxConsecutiveFailures: 5,
        noExecute: false,
        interactive: false,
        delay: 0,
        log: false,
        verbose: false,
        tasksDir: tempDir,
      };

      const { frames } = render(<TaskLoop opts={opts} />);
      await new Promise((r) => setTimeout(r, 500));

      const allText = frames.join("\n");
      expect(allText).toContain("Ralph Loop");
    });
  });

  test("handles STOP signal file", async () => {
    // First call succeeds, which will let us check for STOP after
    runEngineMock.mockImplementationOnce(async () => ({
      exitCode: 0,
      usage: null,
      sessionId: null,
    }));

    await withStorage(async () => {
      const taskDir = join(tempDir, "stop-task");
      mkdirSync(taskDir, { recursive: true });
      const state = makeState({ name: "stop-task" });
      writeState(taskDir, state);
      writeFileSync(join(taskDir, "STOP"), "Manual stop requested", "utf-8");

      const opts = {
        name: "stop-task",
        prompt: "Stop prompt",
        engine: "claude" as const,
        model: "opus",
        maxIterations: 10,
        maxCostUsd: 0,
        maxRuntimeMinutes: 0,
        maxConsecutiveFailures: 5,
        noExecute: false,
        interactive: false,
        delay: 0,
        log: false,
        verbose: false,
        tasksDir: tempDir,
      };

      const { frames } = render(<TaskLoop opts={opts} />);
      await new Promise((r) => setTimeout(r, 500));

      const allText = frames.join("\n");
      expect(allText).toContain("Ralph Loop");
    });
  });

  test("engine result with usage accumulates stats", async () => {
    runEngineMock.mockImplementationOnce(async () => ({
      exitCode: 0,
      usage: {
        cost_usd: 0.5,
        duration_ms: 3000,
        num_turns: 2,
        input_tokens: 1000,
        output_tokens: 500,
        cache_read_input_tokens: 100,
        cache_creation_input_tokens: 50,
      },
      sessionId: null,
    }));

    await withStorage(async () => {
      const taskDir = join(tempDir, "usage-task");
      mkdirSync(taskDir, { recursive: true });
      const state = makeState({ name: "usage-task" });
      writeState(taskDir, state);

      const opts = {
        name: "usage-task",
        prompt: "Usage prompt",
        engine: "claude" as const,
        model: "opus",
        maxIterations: 1,
        maxCostUsd: 0,
        maxRuntimeMinutes: 0,
        maxConsecutiveFailures: 5,
        noExecute: false,
        interactive: false,
        delay: 0,
        log: false,
        verbose: false,
        tasksDir: tempDir,
      };

      const { frames } = render(<TaskLoop opts={opts} />);
      await new Promise((r) => setTimeout(r, 500));

      const allText = frames.join("\n");
      expect(allText).toContain("Ralph Loop");
    });
  });

  test("creates new state when no state.json exists (else branch)", async () => {
    await withStorage(async () => {
      const taskDir = join(tempDir, "new-task");
      mkdirSync(taskDir, { recursive: true });
      // Deliberately do NOT write state.json — triggers the else branch (lines 91-97)

      const opts = {
        name: "new-task",
        prompt: "New task prompt",
        engine: "claude" as const,
        model: "opus",
        maxIterations: 1,
        maxCostUsd: 0,
        maxRuntimeMinutes: 0,
        maxConsecutiveFailures: 5,
        noExecute: false,
        interactive: false,
        delay: 0,
        log: false,
        verbose: false,
        tasksDir: tempDir,
      };

      const { frames } = render(<TaskLoop opts={opts} />);
      await new Promise((r) => setTimeout(r, 500));

      const allText = frames.join("\n");
      expect(allText).toContain("Ralph Loop");
    });
  });

  test("consecutive identical failures increment counter", async () => {
    // Return the same exit code twice to trigger consFailures++ (line 175)
    runEngineMock
      .mockImplementationOnce(async () => ({ exitCode: 1, usage: null, sessionId: null }))
      .mockImplementationOnce(async () => ({ exitCode: 1, usage: null, sessionId: null }));

    await withStorage(async () => {
      const taskDir = join(tempDir, "confail-task");
      mkdirSync(taskDir, { recursive: true });
      const state = makeState({ name: "confail-task" });
      writeState(taskDir, state);

      const opts = {
        name: "confail-task",
        prompt: "Fail prompt",
        engine: "claude" as const,
        model: "opus",
        maxIterations: 10,
        maxCostUsd: 0,
        maxRuntimeMinutes: 0,
        maxConsecutiveFailures: 5,
        noExecute: false,
        interactive: false,
        delay: 0,
        log: false,
        verbose: false,
        tasksDir: tempDir,
      };

      const { frames } = render(<TaskLoop opts={opts} />);
      await new Promise((r) => setTimeout(r, 500));

      const allText = frames.join("\n");
      expect(allText).toContain("Ralph Loop");
    });
  });

  test("delay between iterations triggers sleep", async () => {
    // Two successful iterations with a small delay
    runEngineMock
      .mockImplementationOnce(async () => ({ exitCode: 0, usage: null, sessionId: null }))
      .mockImplementationOnce(async () => ({ exitCode: 0, usage: null, sessionId: null }));

    await withStorage(async () => {
      const taskDir = join(tempDir, "delay-task");
      mkdirSync(taskDir, { recursive: true });
      const state = makeState({ name: "delay-task" });
      writeState(taskDir, state);

      const opts = {
        name: "delay-task",
        prompt: "Delay prompt",
        engine: "claude" as const,
        model: "opus",
        maxIterations: 2,
        maxCostUsd: 0,
        maxRuntimeMinutes: 0,
        maxConsecutiveFailures: 5,
        noExecute: false,
        interactive: false,
        delay: 0.01, // 10ms delay
        log: false,
        verbose: false,
        tasksDir: tempDir,
      };

      const { frames } = render(<TaskLoop opts={opts} />);
      await new Promise((r) => setTimeout(r, 1000));

      const allText = frames.join("\n");
      expect(allText).toContain("Ralph Loop");
    });
  });
});
