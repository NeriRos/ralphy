import { describe, expect, test, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import { showBanner, showStatus, showList } from "../display";
import { buildInitialState } from "@ralphy/core/state";
import { runWithContext, createDefaultContext } from "@ralphy/context";

let tempDir: string;
let logs: string[];
let originalLog: typeof console.log;
const withStorage = <T>(fn: () => T): T => runWithContext(createDefaultContext(), fn);

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "display-test-"));
  logs = [];
  originalLog = console.log;
  spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  console.log = originalLog;
  rmSync(tempDir, { recursive: true, force: true });
});

function outputText(): string {
  return logs.join("\n");
}

describe("showBanner", () => {
  test("displays task name and engine", () => {
    const state = buildInitialState({ name: "my-task", prompt: "do stuff" });
    showBanner(state, { mode: "task" });
    const out = outputText();
    expect(out).toContain("Ralph Loop");
    expect(out).toContain("my-task");
    expect(out).toContain("claude (opus)");
  });

  test("shows resumed tag when isResume is true", () => {
    const state = buildInitialState({ name: "t", prompt: "p" });
    showBanner(state, { mode: "task", isResume: true });
    const out = outputText();
    expect(out).toContain("resumed");
  });

  test("shows no execute label", () => {
    const state = buildInitialState({ name: "t", prompt: "p" });
    showBanner(state, { mode: "task", noExecute: true });
    const out = outputText();
    expect(out).toContain("research+plan only");
  });

  test("truncates long prompts to 6 lines", () => {
    const state = buildInitialState({ name: "t", prompt: "p" });
    const longPrompt = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join("\n");
    showBanner(state, { mode: "task", taskPrompt: longPrompt });
    const out = outputText();
    expect(out).toContain("Line 1");
    expect(out).toContain("Line 6");
    expect(out).toContain("4 more lines");
    expect(out).not.toContain("Line 7");
  });
});

describe("showStatus", () => {
  test("displays task metadata", () =>
    withStorage(() => {
      const state = buildInitialState({ name: "test-task", prompt: "do it" });
      showStatus(state, tempDir);
      const out = outputText();
      expect(out).toContain("Task Status: test-task");
      expect(out).toContain("Phase:");
      expect(out).toContain("research");
      expect(out).toContain("claude (opus)");
    }));

  test("shows usage statistics", () =>
    withStorage(() => {
      const state = buildInitialState({ name: "t", prompt: "p" });
      state.usage.total_cost_usd = 1.234;
      state.usage.total_duration_ms = 60000;
      state.usage.total_turns = 10;
      showStatus(state, tempDir);
      const out = outputText();
      expect(out).toContain("$1.23");
      expect(out).toContain("60s");
      expect(out).toContain("Turns:          10");
    }));

  test("shows file existence status", () =>
    withStorage(() => {
      writeFileSync(join(tempDir, "RESEARCH.md"), "# Research", "utf-8");
      const state = buildInitialState({ name: "t", prompt: "p" });
      showStatus(state, tempDir);
      const out = outputText();
      expect(out).toContain("[x] RESEARCH.md");
      expect(out).toContain("[ ] PLAN.md");
    }));

  test("shows progress from PROGRESS.md", () =>
    withStorage(() => {
      writeFileSync(
        join(tempDir, "PROGRESS.md"),
        "- [x] Done\n- [x] Also done\n- [ ] Todo\n",
        "utf-8",
      );
      const state = buildInitialState({ name: "t", prompt: "p" });
      showStatus(state, tempDir);
      const out = outputText();
      expect(out).toContain("2 done / 1 remaining");
    }));

  test("shows history entries", () =>
    withStorage(() => {
      const state = buildInitialState({ name: "t", prompt: "p" });
      state.history = [
        {
          timestamp: "2026-01-01T00:00:00Z",
          phase: "research",
          iteration: 1,
          engine: "claude",
          model: "opus",
          result: "success",
        },
      ];
      showStatus(state, tempDir);
      const out = outputText();
      expect(out).toContain("research iter 1");
      expect(out).toContain("success");
    }));
});

describe("showList", () => {
  test("shows incomplete tasks", () =>
    withStorage(() => {
      const taskDir = join(tempDir, "my-task");
      mkdirSync(taskDir, { recursive: true });
      writeFileSync(
        join(taskDir, "state.json"),
        JSON.stringify({
          name: "my-task",
          phase: "exec",
          status: "active",
          totalIterations: 3,
          prompt: "convert to typescript",
        }),
        "utf-8",
      );
      showList(tempDir);
      const out = outputText();
      expect(out).toContain("Incomplete Tasks");
      expect(out).toContain("my-task");
      expect(out).toContain("exec");
      expect(out).toContain("convert to typescript");
    }));

  test("skips done tasks", () =>
    withStorage(() => {
      const taskDir = join(tempDir, "done-task");
      mkdirSync(taskDir, { recursive: true });
      writeFileSync(
        join(taskDir, "state.json"),
        JSON.stringify({ name: "done-task", phase: "done", status: "active", prompt: "p" }),
        "utf-8",
      );
      showList(tempDir);
      const out = outputText();
      expect(out).toContain("No incomplete tasks found");
    }));

  test("handles missing tasks directory", () =>
    withStorage(() => {
      showList(join(tempDir, "nonexistent"));
      const out = outputText();
      expect(out).toContain("No tasks directory found");
    }));

  test("shows progress info when PROGRESS.md exists", () =>
    withStorage(() => {
      const taskDir = join(tempDir, "prog-task");
      mkdirSync(taskDir, { recursive: true });
      writeFileSync(
        join(taskDir, "state.json"),
        JSON.stringify({
          name: "prog-task",
          phase: "exec",
          status: "active",
          totalIterations: 2,
          prompt: "p",
        }),
        "utf-8",
      );
      writeFileSync(join(taskDir, "PROGRESS.md"), "- [x] A\n- [ ] B\n- [ ] C\n", "utf-8");
      showList(tempDir);
      const out = outputText();
      expect(out).toContain("progress: 1 done / 2 remaining");
    }));
});
