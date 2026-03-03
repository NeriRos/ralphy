import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
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
  test("registers all 7 tools with correct names", () => {
    const registeredTools: string[] = [];
    const mockServer = {
      registerTool: mock((name: string) => {
        registeredTools.push(name);
      }),
    } as unknown as McpServer;

    registerTools(mockServer, tempDir);

    expect((mockServer.registerTool as ReturnType<typeof mock>).mock.calls.length).toBe(7);
    expect(registeredTools).toEqual([
      "ralph_list_tasks",
      "ralph_get_task",
      "ralph_read_document",
      "ralph_create_task",
      "ralph_run_task",
      "ralph_advance_phase",
      "ralph_update_steering",
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

    expect(data.name).toBe("detail-task");
    expect(data.prompt).toBe("Test task detail-task");
    expect(data.phase).toBe("research");
    expect(data.status).toBe("active");
    expect(data.progress).toEqual({ checked: 1, unchecked: 2, total: 3 });
    // Section 1 still has unchecked items, so it's the current section
    expect(data.currentSection).toContain("Section 1");
    expect(data.documents).toContain("PROGRESS.md");
    expect(data.documents).toContain("STEERING.md");
    expect(data.documents).toContain("RESEARCH.md");
    expect(data.steering).toBe("# Steering\nDo things carefully.");
    expect(data.metadata).toBeDefined();
    expect(data.historyLength).toBe(0);
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

    expect(data.progress).toBeNull();
    expect(data.currentSection).toBeNull();
    expect(data.documents).toEqual([]);
    expect(data.steering).toBeNull();
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
