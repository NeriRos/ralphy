import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  chmodSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Mock commitState (git operations) — no-op in tests
mock.module("@ralphy/core/git", () => ({
  commitState: mock(() => {}),
}));

// Mock child_process.spawn — capture calls without spawning.
// Re-export real execSync so other modules still work.
const spawnMock = mock(() => ({
  unref: () => {},
  pid: 12345,
}));
const realChildProcess = await import("node:child_process");
mock.module("node:child_process", () => ({
  ...realChildProcess,
  spawn: spawnMock,
}));

// Import after mocks are set up
const { registerTools } = await import("../tools");
const { buildInitialState } = await import("@ralphy/core/state");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "mcp-tools-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

type ToolResult = {
  content: { type: string; text: string }[];
  isError?: boolean;
};
type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

/** Register all tools and return a getter for handlers by name. */
function captureHandlers(tasksDir: string): (name: string) => ToolHandler {
  const handlers = new Map<string, ToolHandler>();
  const mockServer = {
    registerTool: (_name: string, _opts: unknown, handler: ToolHandler) => {
      handlers.set(_name, handler);
    },
  } as unknown as McpServer;
  registerTools(mockServer, tasksDir);
  return (name: string) => {
    const h = handlers.get(name);
    if (!h) throw new Error(`No handler registered for ${name}`);
    return h;
  };
}

/** Create a task directory with a valid state.json and return the task dir path. */
function createTask(
  tasksDir: string,
  name: string,
  overrides: Record<string, unknown> = {},
): string {
  const taskDir = join(tasksDir, name);
  mkdirSync(taskDir, { recursive: true });
  const state = buildInitialState({ name, prompt: `Test task ${name}` });
  const merged = { ...state, ...overrides };
  writeFileSync(join(taskDir, "state.json"), JSON.stringify(merged, null, 2) + "\n");
  return taskDir;
}

/** Parse the JSON text from a tool result. */
function parseResult(result: ToolResult): unknown {
  return JSON.parse(result.content[0]!.text);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("registerTools", () => {
  test("registers all 10 tools with correct names", () => {
    const registeredTools: string[] = [];
    const mockServer = {
      registerTool: mock((name: string) => {
        registeredTools.push(name);
      }),
    } as unknown as McpServer;

    registerTools(mockServer, tempDir);

    expect((mockServer.registerTool as ReturnType<typeof mock>).mock.calls.length).toBe(10);
    expect(registeredTools).toEqual([
      "ralph_list_tasks",
      "ralph_get_task",
      "ralph_read_document",
      "ralph_create_task",
      "ralph_run_task",
      "ralph_advance_phase",
      "ralph_update_steering",
      "ralph_finish_interactive",
      "ralph_list_checklists",
      "ralph_apply_checklist",
    ]);
  });
});

describe("ralph_list_tasks", () => {
  test("returns empty list for empty directory", async () => {
    const handler = captureHandlers(tempDir)("ralph_list_tasks");
    const result = await handler({});
    const data = parseResult(result) as { tasks: unknown[] };

    expect(result.isError).toBeUndefined();
    expect(data.tasks).toEqual([]);
  });

  test("returns a single task", async () => {
    createTask(tempDir, "my-task");
    const handler = captureHandlers(tempDir)("ralph_list_tasks");
    const result = await handler({});
    const data = parseResult(result) as { tasks: { name: string; phase: string }[] };

    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0]!.name).toBe("my-task");
    expect(data.tasks[0]!.phase).toBe("research");
  });

  test("returns multiple tasks", async () => {
    createTask(tempDir, "task-a");
    createTask(tempDir, "task-b");
    createTask(tempDir, "task-c");
    const handler = captureHandlers(tempDir)("ralph_list_tasks");
    const result = await handler({});
    const data = parseResult(result) as { tasks: { name: string }[] };

    expect(data.tasks).toHaveLength(3);
    const names = data.tasks.map((t) => t.name).sort();
    expect(names).toEqual(["task-a", "task-b", "task-c"]);
  });

  test("filters out completed tasks when includeCompleted is false", async () => {
    createTask(tempDir, "active-task");
    createTask(tempDir, "done-task", { phase: "done", status: "completed" });
    const handler = captureHandlers(tempDir)("ralph_list_tasks");

    const result = await handler({ includeCompleted: false });
    const data = parseResult(result) as { tasks: { name: string }[] };

    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0]!.name).toBe("active-task");
  });

  test("includes completed tasks when includeCompleted is true", async () => {
    createTask(tempDir, "active-task");
    createTask(tempDir, "done-task", { phase: "done", status: "completed" });
    const handler = captureHandlers(tempDir)("ralph_list_tasks");

    const result = await handler({ includeCompleted: true });
    const data = parseResult(result) as { tasks: { name: string }[] };

    expect(data.tasks).toHaveLength(2);
  });

  test("includes progress when PROGRESS.md exists", async () => {
    const taskDir = createTask(tempDir, "with-progress");
    writeFileSync(
      join(taskDir, "PROGRESS.md"),
      "## Section 1\n- [x] Done\n- [ ] Pending\n- [ ] Also pending\n",
    );
    const handler = captureHandlers(tempDir)("ralph_list_tasks");
    const result = await handler({});
    const data = parseResult(result) as {
      tasks: { name: string; progress: { checked: number; unchecked: number; total: number } }[];
    };

    expect(data.tasks[0]!.progress).toEqual({ checked: 1, unchecked: 2, total: 3 });
  });

  test("returns null progress when PROGRESS.md is absent", async () => {
    createTask(tempDir, "no-progress");
    const handler = captureHandlers(tempDir)("ralph_list_tasks");
    const result = await handler({});
    const data = parseResult(result) as { tasks: { progress: unknown }[] };

    expect(data.tasks[0]!.progress).toBeNull();
  });
});

describe("ralph_get_task", () => {
  test("returns full details for existing task", async () => {
    const taskDir = createTask(tempDir, "detail-task");
    writeFileSync(
      join(taskDir, "PROGRESS.md"),
      "## Section 1 — Setup\n- [x] First\n- [ ] Second\n\n## Section 2 — Build\n- [ ] Third\n",
    );
    writeFileSync(join(taskDir, "STEERING.md"), "# Steering\nDo things carefully.");
    writeFileSync(join(taskDir, "RESEARCH.md"), "# Research\nFindings here.");
    const handler = captureHandlers(tempDir)("ralph_get_task");

    const result = await handler({ name: "detail-task" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as Record<string, unknown>;

    expect(data["name"]).toBe("detail-task");
    expect(data["prompt"]).toBe("Test task detail-task");
    expect(data["phase"]).toBe("research");
    expect(data["status"]).toBe("active");
    expect(data["progress"]).toEqual({ checked: 1, unchecked: 2, total: 3 });
    // Section 1 still has unchecked items, so it's the current section
    expect(data["currentSection"]).toContain("Section 1");
    expect(data["documents"]).toContain("PROGRESS.md");
    expect(data["documents"]).toContain("STEERING.md");
    expect(data["documents"]).toContain("RESEARCH.md");
    expect(data["steering"]).toBe("# Steering\nDo things carefully.");
    expect(data["metadata"]).toBeDefined();
    expect(data["historyLength"]).toBe(0);
  });

  test("returns error for missing task", async () => {
    const handler = captureHandlers(tempDir)("ralph_get_task");
    const result = await handler({ name: "nonexistent" });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("nonexistent");
  });

  test("handles task with no optional documents", async () => {
    createTask(tempDir, "bare-task");
    const handler = captureHandlers(tempDir)("ralph_get_task");

    const result = await handler({ name: "bare-task" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as Record<string, unknown>;

    expect(data["progress"]).toBeNull();
    expect(data["currentSection"]).toBeNull();
    expect(data["documents"]).toEqual([]);
    expect(data["steering"]).toBeNull();
  });
});

describe("ralph_read_document", () => {
  test("reads RESEARCH.md", async () => {
    const taskDir = createTask(tempDir, "doc-task");
    writeFileSync(join(taskDir, "RESEARCH.md"), "# Research\nFindings.");
    const handler = captureHandlers(tempDir)("ralph_read_document");

    const result = await handler({ name: "doc-task", document: "RESEARCH.md" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toBe("# Research\nFindings.");
  });

  test("reads PLAN.md", async () => {
    const taskDir = createTask(tempDir, "doc-task");
    writeFileSync(join(taskDir, "PLAN.md"), "# Plan\nSteps here.");
    const handler = captureHandlers(tempDir)("ralph_read_document");

    const result = await handler({ name: "doc-task", document: "PLAN.md" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toBe("# Plan\nSteps here.");
  });

  test("reads PROGRESS.md", async () => {
    const taskDir = createTask(tempDir, "doc-task");
    writeFileSync(join(taskDir, "PROGRESS.md"), "- [x] Done\n- [ ] Pending");
    const handler = captureHandlers(tempDir)("ralph_read_document");

    const result = await handler({ name: "doc-task", document: "PROGRESS.md" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toBe("- [x] Done\n- [ ] Pending");
  });

  test("reads STEERING.md", async () => {
    const taskDir = createTask(tempDir, "doc-task");
    writeFileSync(join(taskDir, "STEERING.md"), "# Steering\nGuidance.");
    const handler = captureHandlers(tempDir)("ralph_read_document");

    const result = await handler({ name: "doc-task", document: "STEERING.md" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toBe("# Steering\nGuidance.");
  });

  test("returns error for missing document", async () => {
    createTask(tempDir, "no-doc-task");
    const handler = captureHandlers(tempDir)("ralph_read_document");

    const result = await handler({ name: "no-doc-task", document: "RESEARCH.md" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("RESEARCH.md");
    expect(result.content[0]!.text).toContain("no-doc-task");
  });

  test("returns error for missing task", async () => {
    const handler = captureHandlers(tempDir)("ralph_read_document");

    const result = await handler({ name: "nonexistent", document: "PLAN.md" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("nonexistent");
  });
});

describe("ralph_create_task", () => {
  test("creates state.json and STEERING.md", async () => {
    const handler = captureHandlers(tempDir)("ralph_create_task");

    const result = await handler({ name: "new-task", prompt: "Do something" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { created: string; phase: string };
    expect(data.created).toBe("new-task");
    expect(data.phase).toBe("research");

    // Verify files exist on disk
    expect(existsSync(join(tempDir, "new-task", "state.json"))).toBe(true);
    expect(existsSync(join(tempDir, "new-task", "STEERING.md"))).toBe(true);
  });

  test("returns error for duplicate task", async () => {
    createTask(tempDir, "dup-task");
    const handler = captureHandlers(tempDir)("ralph_create_task");

    const result = await handler({ name: "dup-task", prompt: "Duplicate" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("dup-task");
    expect(result.content[0]!.text).toContain("already exists");
  });

  test("applies custom engine and model", async () => {
    const handler = captureHandlers(tempDir)("ralph_create_task");

    await handler({ name: "custom-task", prompt: "Custom", engine: "openai", model: "gpt-4" });

    const stateRaw = readFileSync(join(tempDir, "custom-task", "state.json"), "utf-8");
    const state = JSON.parse(stateRaw) as { engine: string; model: string };
    expect(state.engine).toBe("openai");
    expect(state.model).toBe("gpt-4");
  });

  test("uses default engine and model when omitted", async () => {
    const handler = captureHandlers(tempDir)("ralph_create_task");

    await handler({ name: "default-task", prompt: "Defaults" });

    const stateRaw = readFileSync(join(tempDir, "default-task", "state.json"), "utf-8");
    const state = JSON.parse(stateRaw) as { engine: string; model: string };
    expect(state.engine).toBe("claude");
    expect(state.model).toBe("opus");
  });
});

describe("ralph_run_task", () => {
  beforeEach(() => {
    spawnMock.mockClear();
  });

  test("spawns subprocess with correct default args", async () => {
    createTask(tempDir, "run-task");
    const handler = captureHandlers(tempDir)("ralph_run_task");

    const result = await handler({ name: "run-task" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { started: string; pid: number };
    expect(data.started).toBe("run-task");
    expect(data.pid).toBe(12345);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const calls = spawnMock.mock.calls as unknown as [string, string[], Record<string, unknown>][];
    const call = calls[0]!;
    expect(call[0]).toBe("bun");
    expect(call[1]).toEqual(["run", "apps/cli/src/index.ts", "task", "--name", "run-task"]);
    expect(call[2]).toMatchObject({ detached: true, stdio: "ignore" });
  });

  test("includes optional maxIterations, engine, and model args", async () => {
    createTask(tempDir, "run-opts");
    const handler = captureHandlers(tempDir)("ralph_run_task");

    await handler({ name: "run-opts", maxIterations: 5, engine: "openai", model: "gpt-4" });

    const calls = spawnMock.mock.calls as unknown as [string, string[], Record<string, unknown>][];
    const call = calls[0]!;
    expect(call[1]).toEqual([
      "run",
      "apps/cli/src/index.ts",
      "task",
      "--name",
      "run-opts",
      "5",
      "--engine",
      "openai",
      "--model",
      "gpt-4",
    ]);
  });

  test("returns error for missing task", async () => {
    const handler = captureHandlers(tempDir)("ralph_run_task");

    const result = await handler({ name: "nonexistent" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("nonexistent");
    expect(spawnMock).not.toHaveBeenCalled();
  });
});

describe("ralph_advance_phase", () => {
  test("advances research to plan when RESEARCH.md exists", async () => {
    const taskDir = createTask(tempDir, "adv-task");
    writeFileSync(join(taskDir, "RESEARCH.md"), "# Research\nDone.");
    const handler = captureHandlers(tempDir)("ralph_advance_phase");

    const result = await handler({ name: "adv-task" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { from: string; to: string };
    expect(data.from).toBe("research");
    expect(data.to).toBe("plan");
  });

  test("uses setPhase when explicit phase param provided", async () => {
    const taskDir = createTask(tempDir, "set-phase-task");
    writeFileSync(join(taskDir, "RESEARCH.md"), "# Research");
    const handler = captureHandlers(tempDir)("ralph_advance_phase");

    const result = await handler({ name: "set-phase-task", phase: "exec" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { from: string; to: string };
    expect(data.from).toBe("research");
    expect(data.to).toBe("exec");

    // Verify state was written with the new phase
    const stateRaw = readFileSync(join(tempDir, "set-phase-task", "state.json"), "utf-8");
    const state = JSON.parse(stateRaw) as { phase: string };
    expect(state.phase).toBe("exec");
  });

  test("returns error when prerequisites missing", async () => {
    createTask(tempDir, "no-research-task");
    // No RESEARCH.md — cannot advance from research
    const handler = captureHandlers(tempDir)("ralph_advance_phase");

    const result = await handler({ name: "no-research-task" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("RESEARCH.md");
  });

  test("calls commitState on success", async () => {
    const { commitState: commitMock } = await import("@ralphy/core/git");
    (commitMock as ReturnType<typeof mock>).mockClear();

    const taskDir = createTask(tempDir, "commit-task");
    writeFileSync(join(taskDir, "RESEARCH.md"), "# Research");
    const handler = captureHandlers(tempDir)("ralph_advance_phase");

    await handler({ name: "commit-task" });

    expect(commitMock).toHaveBeenCalledTimes(1);
    const commitCalls = (commitMock as ReturnType<typeof mock>).mock.calls as unknown as [
      string,
      string,
    ][];
    expect(commitCalls[0]![0]).toBe(join(tempDir, "commit-task"));
  });

  test("returns error for missing task", async () => {
    const handler = captureHandlers(tempDir)("ralph_advance_phase");

    const result = await handler({ name: "ghost-task" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("ghost-task");
  });
});

describe("ralph_update_steering", () => {
  test("overwrites STEERING.md content", async () => {
    const taskDir = createTask(tempDir, "steer-task");
    writeFileSync(join(taskDir, "STEERING.md"), "Old content");
    const handler = captureHandlers(tempDir)("ralph_update_steering");

    const result = await handler({
      name: "steer-task",
      content: "# New Steering\nUpdated guidance.",
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("steer-task");

    const content = readFileSync(join(taskDir, "STEERING.md"), "utf-8");
    expect(content).toBe("# New Steering\nUpdated guidance.");
  });

  test("returns error for missing task", async () => {
    const handler = captureHandlers(tempDir)("ralph_update_steering");

    const result = await handler({ name: "nonexistent", content: "New content" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("nonexistent");
  });
});

describe("ralph_list_checklists", () => {
  test("returns available checklists with content", async () => {
    const handler = captureHandlers(tempDir)("ralph_list_checklists");
    const result = await handler({});

    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as {
      checklists: { name: string; content: string }[];
    };
    expect(data.checklists.length).toBeGreaterThan(0);

    const names = data.checklists.map((c) => c.name);
    expect(names).toContain("static");
    expect(names).toContain("tests");

    // Each checklist should have content
    for (const cl of data.checklists) {
      expect(cl.content.length).toBeGreaterThan(0);
    }
  });
});

describe("ralph_apply_checklist", () => {
  test("appends checklists as numbered sections to PROGRESS.md", async () => {
    const taskDir = createTask(tempDir, "cl-task");
    writeFileSync(join(taskDir, "PROGRESS.md"), "## Section 1 — Setup\n\n- [ ] First item\n");
    const handler = captureHandlers(tempDir)("ralph_apply_checklist");

    const result = await handler({
      name: "cl-task",
      checklists: ["static", "tests"],
    });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { applied: string[]; totalSections: number };
    expect(data.applied).toEqual(["static", "tests"]);
    expect(data.totalSections).toBe(3);

    // Verify PROGRESS.md was updated
    const progress = readFileSync(join(taskDir, "PROGRESS.md"), "utf-8");
    expect(progress).toContain("## Section 2 — Static Analysis");
    expect(progress).toContain("## Section 3 — Tests");
    expect(progress).toContain("**Lint**");
    expect(progress).toContain("**Unit tests**");
  });

  test("returns error when PROGRESS.md does not exist", async () => {
    createTask(tempDir, "no-progress-task");
    const handler = captureHandlers(tempDir)("ralph_apply_checklist");

    const result = await handler({
      name: "no-progress-task",
      checklists: ["static"],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("PROGRESS.md");
  });

  test("returns error for missing task", async () => {
    const handler = captureHandlers(tempDir)("ralph_apply_checklist");

    const result = await handler({ name: "ghost", checklists: ["static"] });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("ghost");
  });

  test("skips unknown checklist names gracefully", async () => {
    const taskDir = createTask(tempDir, "skip-task");
    writeFileSync(join(taskDir, "PROGRESS.md"), "## Section 1 — Setup\n\n- [ ] Item\n");
    const handler = captureHandlers(tempDir)("ralph_apply_checklist");

    const result = await handler({
      name: "skip-task",
      checklists: ["nonexistent_checklist"],
    });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { applied: string[] };
    expect(data.applied).toEqual([]);
  });

  test("handles checklist without H1 heading (parseChecklist fallback)", async () => {
    // Create a temporary checklist file without an H1 heading
    const { resolveChecklistDir } = await import("@ralphy/phases");
    const checklistDir = resolveChecklistDir();
    const tempChecklistPath = join(checklistDir, "_test_no_h1.md");
    writeFileSync(tempChecklistPath, "- [ ] Item without heading\n- [ ] Another item\n");

    try {
      const taskDir = createTask(tempDir, "no-h1-task");
      writeFileSync(join(taskDir, "PROGRESS.md"), "## Section 1 — Setup\n\n- [ ] Item\n");
      const handler = captureHandlers(tempDir)("ralph_apply_checklist");

      const result = await handler({
        name: "no-h1-task",
        checklists: ["_test_no_h1"],
      });
      expect(result.isError).toBeUndefined();
      const data = parseResult(result) as { applied: string[]; totalSections: number };
      expect(data.applied).toEqual(["_test_no_h1"]);
      expect(data.totalSections).toBe(2);

      // Verify PROGRESS.md uses fallback title "Checklist"
      const progress = readFileSync(join(taskDir, "PROGRESS.md"), "utf-8");
      expect(progress).toContain("## Section 2 — Checklist");
      expect(progress).toContain("Item without heading");
    } finally {
      rmSync(tempChecklistPath, { force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Error path tests — cover catch blocks in each tool handler
// ---------------------------------------------------------------------------

describe("ralph_list_tasks error path", () => {
  test("returns error when tasksDir is a file (not a directory)", async () => {
    // Create a file where the tasks directory is expected, so storage.list() throws
    const filePath = join(tempDir, "not-a-dir");
    writeFileSync(filePath, "I am a file");

    const handler = captureHandlers(filePath)("ralph_list_tasks");
    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Error listing tasks");
  });
});

describe("ralph_read_document error path", () => {
  test("returns error when document path is a directory (readFileSync throws)", async () => {
    const taskDir = createTask(tempDir, "dir-doc-task");
    // Create a directory where RESEARCH.md should be a file
    mkdirSync(join(taskDir, "RESEARCH.md"), { recursive: true });

    const handler = captureHandlers(tempDir)("ralph_read_document");
    const result = await handler({ name: "dir-doc-task", document: "RESEARCH.md" });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Error reading document");
  });
});

describe("ralph_create_task error path", () => {
  test("returns error when task directory cannot be created", async () => {
    // Create a file where the tasks dir is expected, so mkdir fails for the task subdir
    const filePath = join(tempDir, "blocked");
    writeFileSync(filePath, "I am a file");

    const handler = captureHandlers(filePath)("ralph_create_task");
    const result = await handler({ name: "new-task", prompt: "Will fail" });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Error creating task");
  });
});

describe("ralph_run_task error path", () => {
  test("returns error when spawn throws", async () => {
    createTask(tempDir, "spawn-fail-task");
    spawnMock.mockImplementationOnce(() => {
      throw new Error("spawn failed");
    });

    const handler = captureHandlers(tempDir)("ralph_run_task");
    const result = await handler({ name: "spawn-fail-task" });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Error running task");
    expect(result.content[0]!.text).toContain("spawn failed");
  });

  test("includes maxCostUsd and maxRuntimeMinutes args when provided", async () => {
    spawnMock.mockClear();
    createTask(tempDir, "cost-runtime-task");
    const handler = captureHandlers(tempDir)("ralph_run_task");

    await handler({
      name: "cost-runtime-task",
      maxCostUsd: 10,
      maxRuntimeMinutes: 30,
    });

    const calls = spawnMock.mock.calls as unknown as [string, string[], Record<string, unknown>][];
    const call = calls[0]!;
    expect(call[1]).toContain("--max-cost");
    expect(call[1]).toContain("10");
    expect(call[1]).toContain("--max-runtime");
    expect(call[1]).toContain("30");
  });
});

describe("ralph_update_steering error path", () => {
  test("returns error when storage.write throws", async () => {
    // Create a file where the tasks dir is expected, so the state check might still succeed
    // but the write will fail. We need a task that exists but whose STEERING.md path is broken.
    // Create a valid task, then make the task dir read-only to cause write failure.
    const taskDir = createTask(tempDir, "write-fail-task");
    // Create a directory where STEERING.md should be written, so writeFileSync throws EISDIR
    mkdirSync(join(taskDir, "STEERING.md"), { recursive: true });

    const handler = captureHandlers(tempDir)("ralph_update_steering");
    const result = await handler({
      name: "write-fail-task",
      content: "New content",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Error updating steering");
  });
});

describe("ralph_finish_interactive", () => {
  test("writes INTERACTIVE.md and signal file for existing task", async () => {
    const { commitState: commitMock } = await import("@ralphy/core/git");
    (commitMock as ReturnType<typeof mock>).mockClear();

    createTask(tempDir, "interactive-task");
    const handler = captureHandlers(tempDir)("ralph_finish_interactive");

    const result = await handler({
      name: "interactive-task",
      context: "User wants feature X with constraint Y.",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("Interactive session complete");
    expect(result.content[0]!.text).toContain("interactive-task");

    // Verify INTERACTIVE.md was written
    const interactiveContent = readFileSync(
      join(tempDir, "interactive-task", "INTERACTIVE.md"),
      "utf-8",
    );
    expect(interactiveContent).toContain("# Interactive Session Context");
    expect(interactiveContent).toContain("User wants feature X with constraint Y.");
    expect(interactiveContent).toContain("authoritative requirements");

    // Verify signal file was written
    const signalContent = readFileSync(
      join(tempDir, "interactive-task", "_interactive_done"),
      "utf-8",
    );
    // Should be an ISO date string
    expect(signalContent).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Verify commitState was called
    expect(commitMock).toHaveBeenCalledTimes(1);
  });

  test("returns error for missing task", async () => {
    const handler = captureHandlers(tempDir)("ralph_finish_interactive");

    const result = await handler({
      name: "nonexistent",
      context: "Some context",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("nonexistent");
    expect(result.content[0]!.text).toContain("does not exist");
  });

  test("returns error when write fails", async () => {
    const taskDir = createTask(tempDir, "finish-fail-task");
    // Create a directory where INTERACTIVE.md should be written, so writeFileSync throws EISDIR
    mkdirSync(join(taskDir, "INTERACTIVE.md"), { recursive: true });

    const handler = captureHandlers(tempDir)("ralph_finish_interactive");
    const result = await handler({
      name: "finish-fail-task",
      context: "Will fail",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Error finishing interactive session");
  });
});

describe("ralph_list_checklists error path", () => {
  test("returns error when listChecklists throws", async () => {
    // To trigger the catch block, we need resolveChecklistDir or listChecklists to throw.
    // We can temporarily rename the checklists dir, but that's fragile.
    // Instead, we use a mock approach: mock the module inline for this one test.
    const { resolveChecklistDir } = await import("@ralphy/phases");
    // We can't easily mock these since they're used inside the handler which imports them directly.
    // However, if we make getStorage() throw by running without context, we can trigger the catch.
    // Actually, the handler creates its own context via runWithContext(createDefaultContext(), ...).
    // The most reliable approach is to create a situation where storage.read throws on the
    // checklist dir content. Since the catch is a safety net, let's verify the handler
    // structure by checking that the error path returns the expected format.
    // We'll skip this test if we can't trigger it naturally.

    // Alternative: remove read permission from the checklists dir temporarily
    const checklistDir = resolveChecklistDir();
    try {
      chmodSync(checklistDir, 0o000);
      const handler = captureHandlers(tempDir)("ralph_list_checklists");
      const result = await handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("Error listing checklists");
    } finally {
      // Restore permissions
      chmodSync(checklistDir, 0o755);
    }
  });
});

describe("ralph_apply_checklist error path", () => {
  test("returns error when storage.write on PROGRESS.md throws", async () => {
    const taskDir = createTask(tempDir, "apply-fail-task");
    // Create PROGRESS.md as a directory so the final write fails
    mkdirSync(join(taskDir, "PROGRESS.md"), { recursive: true });
    // We need storage.read to succeed first. A directory with existsSync returns true,
    // but readFileSync on a dir throws. So this will actually throw in the read step.
    // That means we need a different approach: create PROGRESS.md as a file first,
    // then replace it with a directory before the write. Since they happen sequentially
    // in the same sync call, we can't do that.

    // Alternative: use a path where checklist dir resolution fails
    // Let's try: make the task have a PROGRESS.md that's valid, but then the storage.write
    // call at the end will fail if we make it read-only.
    rmSync(join(taskDir, "PROGRESS.md"), { recursive: true, force: true });
    writeFileSync(join(taskDir, "PROGRESS.md"), "## Section 1\n\n- [ ] Item\n");
    // Make the entire taskDir read-only so the write fails
    chmodSync(join(taskDir, "PROGRESS.md"), 0o444);
    chmodSync(taskDir, 0o555);

    const handler = captureHandlers(tempDir)("ralph_apply_checklist");
    const result = await handler({
      name: "apply-fail-task",
      checklists: ["static"],
    });

    // Restore permissions before assertions
    chmodSync(taskDir, 0o755);
    chmodSync(join(taskDir, "PROGRESS.md"), 0o644);

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Error applying checklists");
  });

  test("applies checklist to PROGRESS.md with no existing sections", async () => {
    const taskDir = createTask(tempDir, "no-sections-task");
    writeFileSync(join(taskDir, "PROGRESS.md"), "# Progress\n\nNo sections yet.\n");
    const handler = captureHandlers(tempDir)("ralph_apply_checklist");

    const result = await handler({
      name: "no-sections-task",
      checklists: ["static"],
    });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { applied: string[]; totalSections: number };
    expect(data.applied).toEqual(["static"]);
    expect(data.totalSections).toBe(1);

    const progress = readFileSync(join(taskDir, "PROGRESS.md"), "utf-8");
    expect(progress).toContain("## Section 1 — Static Analysis");
  });

  test("includes tasks with unknown phase in list_tasks", async () => {
    // Create a task with a completely unknown phase to test the catch in line 42-44
    createTask(tempDir, "unknown-phase-task", { phase: "nonexistent_phase_xyz" });
    const handler = captureHandlers(tempDir)("ralph_list_tasks");

    const result = await handler({});
    const data = parseResult(result) as { tasks: { name: string; phase: string }[] };

    // Unknown phase tasks should still be included
    const found = data.tasks.find((t) => t.name === "unknown-phase-task");
    expect(found).toBeDefined();
    expect(found!.phase).toBe("nonexistent_phase_xyz");
  });
});
