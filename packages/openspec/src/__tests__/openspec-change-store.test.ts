import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ChangeStore } from "@ralphy/change-store";

type SpawnResult = { status: number; stdout: string; stderr: string };

const spawnCalls: { command: string; args: string[] }[] = [];
let nextSpawnResult: SpawnResult = { status: 0, stdout: "", stderr: "" };

mock.module("node:child_process", () => ({
  spawnSync: (command: string, args: string[]) => {
    spawnCalls.push({ command, args });
    return { ...nextSpawnResult };
  },
}));

const { OpenSpecChangeStore } = await import("../openspec-change-store");

let tempDir: string;
let originalCwd: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "openspec-store-test-"));
  originalCwd = process.cwd();
  process.chdir(tempDir);
  mkdirSync(join(tempDir, "openspec", "changes", "sample-change"), { recursive: true });
  spawnCalls.length = 0;
  nextSpawnResult = { status: 0, stdout: "", stderr: "" };
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tempDir, { recursive: true, force: true });
});

describe("OpenSpecChangeStore", () => {
  test("satisfies the ChangeStore interface", () => {
    const store: ChangeStore = new OpenSpecChangeStore();
    expect(typeof store.createChange).toBe("function");
    expect(typeof store.archiveChange).toBe("function");
    expect(typeof store.validateChange).toBe("function");
    expect(typeof store.getChangeDirectory).toBe("function");
    expect(typeof store.readTaskList).toBe("function");
    expect(typeof store.writeTaskList).toBe("function");
    expect(typeof store.appendSteering).toBe("function");
    expect(typeof store.readSection).toBe("function");
    expect(typeof store.listChanges).toBe("function");
  });

  test("getChangeDirectory returns the expected path", () => {
    const store = new OpenSpecChangeStore();
    expect(store.getChangeDirectory("sample-change")).toBe(
      join("openspec", "changes", "sample-change"),
    );
  });

  test("readTaskList reads tasks.md from the change directory", async () => {
    const store = new OpenSpecChangeStore();
    const tasksPath = join(tempDir, "openspec", "changes", "sample-change", "tasks.md");
    writeFileSync(tasksPath, "## Work\n- [ ] item one\n", "utf-8");

    const content = await store.readTaskList("sample-change");
    expect(content).toContain("item one");
  });

  test("readTaskList returns empty string when tasks.md is missing", async () => {
    const store = new OpenSpecChangeStore();
    const content = await store.readTaskList("sample-change");
    expect(content).toBe("");
  });

  test("writeTaskList writes tasks.md to the change directory", async () => {
    const store = new OpenSpecChangeStore();
    await store.writeTaskList("sample-change", "## Work\n- [ ] new item\n");

    const tasksPath = join(tempDir, "openspec", "changes", "sample-change", "tasks.md");
    expect(existsSync(tasksPath)).toBe(true);
    expect(readFileSync(tasksPath, "utf-8")).toContain("new item");
  });

  test("appendSteering creates steering.md when missing", async () => {
    const store = new OpenSpecChangeStore();
    await store.appendSteering("sample-change", "Initial steering");

    const steeringPath = join(tempDir, "openspec", "changes", "sample-change", "steering.md");
    expect(existsSync(steeringPath)).toBe(true);
    const content = readFileSync(steeringPath, "utf-8");
    expect(content).toContain("Initial steering");
  });

  test("appendSteering prepends to existing steering.md", async () => {
    const store = new OpenSpecChangeStore();
    const steeringPath = join(tempDir, "openspec", "changes", "sample-change", "steering.md");
    writeFileSync(steeringPath, "Original note\n", "utf-8");

    await store.appendSteering("sample-change", "Follow-up note");

    const updated = readFileSync(steeringPath, "utf-8");
    expect(updated).toContain("Original note");
    expect(updated).toContain("Follow-up note");
    expect(updated.indexOf("Follow-up note")).toBeLessThan(updated.indexOf("Original note"));
  });

  test("createChange invokes `bunx openspec new change`", async () => {
    const store = new OpenSpecChangeStore();
    await store.createChange("my-change", "A new change");

    expect(spawnCalls.length).toBe(1);
    const call = spawnCalls[0]!;
    expect(call.command).toBe("bunx");
    expect(call.args).toContain("openspec");
    expect(call.args).toContain("new");
    expect(call.args).toContain("change");
    expect(call.args).toContain("my-change");
  });

  test("createChange throws when spawn exits non-zero", () => {
    nextSpawnResult = { status: 1, stdout: "", stderr: "boom" };
    const store = new OpenSpecChangeStore();
    expect(() => store.createChange("bad-change", "desc")).toThrow();
  });

  test("validateChange parses JSON output into a ValidationResult", async () => {
    nextSpawnResult = {
      status: 0,
      stdout: JSON.stringify({ valid: true, warnings: ["minor"], errors: [] }),
      stderr: "",
    };
    const store = new OpenSpecChangeStore();
    const result = await store.validateChange("sample-change");

    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual(["minor"]);
    expect(result.errors).toEqual([]);
  });

  test("archiveChange invokes `bunx openspec archive`", async () => {
    const store = new OpenSpecChangeStore();
    await store.archiveChange("sample-change");

    expect(spawnCalls.length).toBe(1);
    const call = spawnCalls[0]!;
    expect(call.command).toBe("bunx");
    expect(call.args).toContain("openspec");
    expect(call.args).toContain("archive");
    expect(call.args).toContain("sample-change");
  });

  test("archiveChange throws when spawn exits non-zero", () => {
    nextSpawnResult = { status: 2, stdout: "", stderr: "error" };
    const store = new OpenSpecChangeStore();
    expect(() => store.archiveChange("sample-change")).toThrow();
  });
});
