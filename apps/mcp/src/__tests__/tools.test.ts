import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
import { mkdtempSync } from "node:fs";
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

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "mcp-tools-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

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
