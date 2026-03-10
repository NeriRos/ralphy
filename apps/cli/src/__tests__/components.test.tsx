import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { render } from "ink-testing-library";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import { runWithContext, createDefaultContext } from "@ralphy/context";
import { buildInitialState } from "@ralphy/core/state";
import type { State } from "@ralphy/types";
import type { BuildInitialStateOpts } from "@ralphy/core/state";
import { Banner } from "../components/Banner";
import { TaskStatus } from "../components/TaskStatus";
import { TaskList } from "../components/TaskList";
import { IterationHeader } from "../components/IterationHeader";
import { StopMessage } from "../components/StopMessage";
import { App } from "../components/App";
import type { ParsedArgs } from "../cli";

let tempDir: string;
function withStorage<T>(fn: () => T): T {
  return runWithContext(createDefaultContext(), fn);
}

function findFrame(frames: string[], text: string): string {
  return frames.find((f) => f.includes(text)) ?? frames[0] ?? "";
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "components-test-"));
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

describe("Banner", () => {
  test("renders task name and mode", () => {
    const state = makeState();
    const { lastFrame } = render(<Banner state={state} mode="task" taskPrompt="Do something" />);
    const frame = lastFrame()!;
    expect(frame).toContain("Ralph Loop");
    expect(frame).toContain("test-task");
    expect(frame).toContain("task");
  });

  test("renders engine label with model", () => {
    const state = makeState({ engine: "claude", model: "sonnet" });
    const { lastFrame } = render(<Banner state={state} mode="task" />);
    const frame = lastFrame()!;
    expect(frame).toContain("claude (sonnet)");
  });

  test("shows resumed indicator when isResume is true", () => {
    const state = makeState();
    const { lastFrame } = render(<Banner state={state} mode="task" isResume />);
    expect(lastFrame()!).toContain("(resumed)");
  });

  test("shows max iterations label", () => {
    const state = makeState();
    const { lastFrame } = render(<Banner state={state} mode="task" maxIterations={10} />);
    expect(lastFrame()!).toContain("10");
  });

  test("shows unlimited when maxIterations is 0", () => {
    const state = makeState();
    const { lastFrame } = render(<Banner state={state} mode="task" maxIterations={0} />);
    expect(lastFrame()!).toContain("unlimited");
  });

  test("shows cost cap when set", () => {
    const state = makeState();
    const { lastFrame } = render(<Banner state={state} mode="task" maxCostUsd={5.5} />);
    expect(lastFrame()!).toContain("$5.5");
  });

  test("shows no-execute flag", () => {
    const state = makeState();
    const { lastFrame } = render(<Banner state={state} mode="task" noExecute />);
    expect(lastFrame()!).toContain("yes (research+plan only)");
  });

  test("shows prompt preview in task mode", () => {
    const state = makeState();
    const { lastFrame } = render(
      <Banner state={state} mode="task" taskPrompt="Build a new feature" />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("Prompt");
    expect(frame).toContain("Build a new feature");
  });

  test("truncates long prompts", () => {
    const state = makeState();
    const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`);
    const { lastFrame } = render(
      <Banner state={state} mode="task" taskPrompt={lines.join("\n")} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("Line 1");
    expect(frame).toContain("Line 6");
    expect(frame).toContain("4 more lines");
    expect(frame).not.toContain("Line 7");
  });

  test("shows branch name", () => {
    const state = makeState();
    const { lastFrame } = render(<Banner state={state} mode="task" />);
    expect(lastFrame()!).toContain("Branch");
  });
});

describe("TaskStatus", () => {
  test("renders task name and phase", () =>
    withStorage(() => {
      const state = makeState({ phase: "exec" });
      const { lastFrame } = render(<TaskStatus state={state} taskDir={tempDir} />);
      const frame = lastFrame()!;
      expect(frame).toContain("test-task");
      expect(frame).toContain("exec");
    }));

  test("renders usage stats", () =>
    withStorage(() => {
      const state = {
        ...makeState(),
        usage: {
          total_cost_usd: 1.234,
          total_duration_ms: 5500,
          total_turns: 3,
          total_input_tokens: 1000,
          total_output_tokens: 500,
          total_cache_read_input_tokens: 200,
          total_cache_creation_input_tokens: 0,
        },
      };
      const { lastFrame } = render(<TaskStatus state={state} taskDir={tempDir} />);
      const frame = lastFrame()!;
      expect(frame).toContain("$1.23");
      expect(frame).toContain("5.5s");
      expect(frame).toContain("1000");
      expect(frame).toContain("500");
    }));

  test("shows document existence checkmarks", () =>
    withStorage(() => {
      const state = makeState();
      writeFileSync(join(tempDir, "RESEARCH.md"), "research content", "utf-8");
      writeFileSync(join(tempDir, "PLAN.md"), "plan content", "utf-8");
      const { lastFrame } = render(<TaskStatus state={state} taskDir={tempDir} />);
      const frame = lastFrame()!;
      expect(frame).toContain("[x] RESEARCH.md");
      expect(frame).toContain("[x] PLAN.md");
      expect(frame).toContain("[ ] PROGRESS.md");
    }));

  test("shows progress counts when PROGRESS.md exists", () =>
    withStorage(() => {
      const state = makeState();
      writeFileSync(
        join(tempDir, "PROGRESS.md"),
        "- [x] Done item\n- [ ] Pending item\n- [ ] Another pending\n",
        "utf-8",
      );
      const { lastFrame } = render(<TaskStatus state={state} taskDir={tempDir} />);
      const frame = lastFrame()!;
      expect(frame).toContain("1 done");
      expect(frame).toContain("2 remaining");
    }));

  test("shows history entries", () =>
    withStorage(() => {
      const state = {
        ...makeState(),
        history: [
          {
            timestamp: "2026-03-09T10:00:00Z",
            phase: "research",
            iteration: 1,
            engine: "claude",
            model: "opus",
            result: "success",
          },
        ],
      };
      const { lastFrame } = render(<TaskStatus state={state} taskDir={tempDir} />);
      const frame = lastFrame()!;
      expect(frame).toContain("research");
      expect(frame).toContain("success");
    }));
});

describe("TaskList", () => {
  test("shows 'No incomplete tasks' when empty", () =>
    withStorage(() => {
      mkdirSync(tempDir, { recursive: true });
      const { lastFrame } = render(<TaskList tasksDir={tempDir} />);
      expect(lastFrame()!).toContain("No incomplete tasks");
    }));

  test("renders task rows for incomplete tasks", () =>
    withStorage(() => {
      const taskDir = join(tempDir, "my-task");
      mkdirSync(taskDir, { recursive: true });
      const state = makeState({ name: "my-task", prompt: "Build something" });
      writeFileSync(join(taskDir, "state.json"), JSON.stringify(state), "utf-8");

      const { frames } = render(<TaskList tasksDir={tempDir} />);
      const frame = findFrame(frames, "my-task");
      expect(frame).toContain("my-task");
      expect(frame).toContain("Build something");
    }));

  test("skips tasks with phase=done", () =>
    withStorage(() => {
      const taskDir = join(tempDir, "done-task");
      mkdirSync(taskDir, { recursive: true });
      const state = { ...makeState({ name: "done-task" }), phase: "done" };
      writeFileSync(join(taskDir, "state.json"), JSON.stringify(state), "utf-8");

      const { lastFrame } = render(<TaskList tasksDir={tempDir} />);
      expect(lastFrame()!).toContain("No incomplete tasks");
    }));

  test("shows progress counts when PROGRESS.md exists", () =>
    withStorage(() => {
      const taskDir = join(tempDir, "prog-task");
      mkdirSync(taskDir, { recursive: true });
      const state = makeState({ name: "prog-task", prompt: "Test" });
      writeFileSync(join(taskDir, "state.json"), JSON.stringify(state), "utf-8");
      writeFileSync(join(taskDir, "PROGRESS.md"), "- [x] One\n- [x] Two\n- [ ] Three\n", "utf-8");

      const { frames } = render(<TaskList tasksDir={tempDir} />);
      const frame = findFrame(frames, "2/3");
      expect(frame).toContain("2/3");
    }));

  test("renders table headers", () =>
    withStorage(() => {
      const taskDir = join(tempDir, "header-task");
      mkdirSync(taskDir, { recursive: true });
      const state = makeState({ name: "header-task", prompt: "Test" });
      writeFileSync(join(taskDir, "state.json"), JSON.stringify(state), "utf-8");

      const { lastFrame } = render(<TaskList tasksDir={tempDir} />);
      const frame = lastFrame()!;
      expect(frame).toContain("Name");
      expect(frame).toContain("Phase");
      expect(frame).toContain("Status");
      expect(frame).toContain("Description");
    }));
});

describe("IterationHeader", () => {
  test("renders iteration number", () => {
    const { lastFrame } = render(<IterationHeader iteration={3} time="12:34:56" />);
    const frame = lastFrame()!;
    expect(frame).toContain("#3");
  });

  test("renders time", () => {
    const { lastFrame } = render(<IterationHeader iteration={1} time="09:15:00" />);
    expect(lastFrame()!).toContain("09:15:00");
  });
});

describe("StopMessage", () => {
  test("renders terminal stop with progress", () =>
    withStorage(() => {
      const state = makeState();
      writeFileSync(join(tempDir, "PROGRESS.md"), "- [x] Done\n- [x] Also done\n", "utf-8");
      const { lastFrame } = render(
        <StopMessage reason="terminal" state={state} taskDir={tempDir} consecutiveFailures={0} />,
      );
      const frame = lastFrame()!;
      expect(frame).toContain("2 done");
      expect(frame).toContain("Task complete");
      expect(frame).toContain("PROGRESS.md");
    }));

  test("renders noExecute stop", () =>
    withStorage(() => {
      const state = makeState();
      const { lastFrame } = render(
        <StopMessage reason="noExecute" state={state} taskDir={tempDir} consecutiveFailures={0} />,
      );
      const frame = lastFrame()!;
      expect(frame).toContain("--no-execute");
      expect(frame).toContain("PLAN.md");
    }));

  test("renders maxIterations stop", () => {
    const state = makeState();
    const { lastFrame } = render(
      <StopMessage
        reason="maxIterations"
        state={state}
        taskDir={tempDir}
        maxIterations={10}
        consecutiveFailures={0}
      />,
    );
    expect(lastFrame()!).toContain("10");
  });

  test("renders costCap stop", () => {
    const state = {
      ...makeState(),
      usage: {
        total_cost_usd: 5.99,
        total_duration_ms: 0,
        total_turns: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cache_read_input_tokens: 0,
        total_cache_creation_input_tokens: 0,
      },
    };
    const { lastFrame } = render(
      <StopMessage
        reason="costCap"
        state={state}
        taskDir={tempDir}
        maxCostUsd={6}
        consecutiveFailures={0}
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("$5.99");
    expect(frame).toContain("$6");
  });

  test("renders runtimeLimit stop", () => {
    const state = makeState();
    const { lastFrame } = render(
      <StopMessage
        reason="runtimeLimit"
        state={state}
        taskDir={tempDir}
        maxRuntimeMinutes={30}
        consecutiveFailures={0}
      />,
    );
    expect(lastFrame()!).toContain("30 minute");
  });

  test("renders consecutiveFailures stop", () => {
    const state = makeState();
    const { lastFrame } = render(
      <StopMessage
        reason="consecutiveFailures"
        state={state}
        taskDir={tempDir}
        consecutiveFailures={5}
      />,
    );
    expect(lastFrame()!).toContain("5 consecutive identical failures");
  });
});

function makeArgs(overrides: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    mode: "task",
    name: "",
    prompt: "",
    engine: "claude",
    model: "opus",
    engineSet: false,
    maxIterations: 0,
    maxCostUsd: 0,
    maxRuntimeMinutes: 0,
    maxConsecutiveFailures: 5,
    phase: "",
    noExecute: false,
    interactive: false,
    delay: 0,
    log: false,
    verbose: false,
    ...overrides,
  };
}

describe("App", () => {
  const tick = () => new Promise((r) => setTimeout(r, 0));

  test("list mode renders TaskList", () =>
    withStorage(() => {
      mkdirSync(tempDir, { recursive: true });
      const { lastFrame } = render(<App args={makeArgs({ mode: "list" })} tasksDir={tempDir} />);
      expect(lastFrame()!).toContain("No incomplete tasks");
    }));

  test("status mode without name shows error", async () => {
    const { frames } = withStorage(() =>
      render(<App args={makeArgs({ mode: "status" })} tasksDir={tempDir} />),
    );
    await tick();
    const frame = findFrame(frames, "--name is required");
    expect(frame).toContain("--name is required");
    process.exitCode = 0;
  });

  test("status mode with missing task shows error", async () => {
    const { lastFrame } = withStorage(() =>
      render(<App args={makeArgs({ mode: "status", name: "nonexistent" })} tasksDir={tempDir} />),
    );
    expect(lastFrame()!).toContain("not found");
    await tick();
    process.exitCode = 0;
  });

  test("status mode renders TaskStatus for existing task", () =>
    withStorage(() => {
      const taskDir = join(tempDir, "my-task");
      mkdirSync(taskDir, { recursive: true });
      const state = makeState({ name: "my-task", phase: "exec" });
      writeFileSync(join(taskDir, "state.json"), JSON.stringify(state), "utf-8");

      const { lastFrame } = render(
        <App args={makeArgs({ mode: "status", name: "my-task" })} tasksDir={tempDir} />,
      );
      const frame = lastFrame()!;
      expect(frame).toContain("my-task");
      expect(frame).toContain("exec");
    }));

  test("advance mode without name shows error", async () => {
    const { frames } = withStorage(() =>
      render(<App args={makeArgs({ mode: "advance" })} tasksDir={tempDir} />),
    );
    await tick();
    const frame = findFrame(frames, "--name is required");
    expect(frame).toContain("--name is required");
    process.exitCode = 0;
  });

  test("set-phase mode without name shows error", async () => {
    const { lastFrame } = withStorage(() =>
      render(<App args={makeArgs({ mode: "set-phase" })} tasksDir={tempDir} />),
    );
    expect(lastFrame()!).toContain("--name is required");
    await tick();
    process.exitCode = 0;
  });

  test("set-phase mode without phase shows error", async () => {
    const { lastFrame } = withStorage(() => {
      const taskDir = join(tempDir, "my-task");
      mkdirSync(taskDir, { recursive: true });
      const state = makeState({ name: "my-task" });
      writeFileSync(join(taskDir, "state.json"), JSON.stringify(state), "utf-8");

      return render(
        <App args={makeArgs({ mode: "set-phase", name: "my-task" })} tasksDir={tempDir} />,
      );
    });
    expect(lastFrame()!).toContain("--phase is required");
    await tick();
    process.exitCode = 0;
  });
});
