import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { readState, writeState, updateState, buildInitialState, ensureState } from "../state";
import { runWithContext, createDefaultContext } from "@ralphy/context";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";

let tempDir: string;
const withStorage = <T>(fn: () => T): T => runWithContext(createDefaultContext(), fn);

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "state-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("readState / writeState", () => {
  test("round-trips a valid state object", () =>
    withStorage(() => {
      const state = buildInitialState({ name: "test", prompt: "do things" });
      writeState(tempDir, state);
      const read = readState(tempDir);
      expect(read.name).toBe("test");
      expect(read.prompt).toBe("do things");
      expect(read.version).toBe("2");
    }));

  test("throws when .ralph-state.json is missing", () =>
    withStorage(() => {
      expect(() => readState(tempDir)).toThrow();
    }));

  test("throws when .ralph-state.json contains invalid JSON", () =>
    withStorage(() => {
      writeFileSync(join(tempDir, ".ralph-state.json"), "not json", "utf-8");
      expect(() => readState(tempDir)).toThrow();
    }));

  test("written file is valid JSON with trailing newline", () =>
    withStorage(() => {
      const state = buildInitialState({ name: "test", prompt: "p" });
      writeState(tempDir, state);
      const raw = readFileSync(join(tempDir, ".ralph-state.json"), "utf-8");
      expect(raw.endsWith("\n")).toBe(true);
      expect(() => JSON.parse(raw)).not.toThrow();
    }));
});

describe("updateState", () => {
  test("applies updater function and persists", () =>
    withStorage(() => {
      const state = buildInitialState({ name: "test", prompt: "p" });
      writeState(tempDir, state);

      const updated = updateState(tempDir, (snapshot) => ({
        ...snapshot,
        status: "blocked" as const,
      }));

      expect(updated.status).toBe("blocked");

      // Verify persisted
      const reread = readState(tempDir);
      expect(reread.status).toBe("blocked");
    }));
});

describe("buildInitialState", () => {
  test("creates state with required fields", () => {
    const state = buildInitialState({ name: "my-task", prompt: "convert to ts" });
    expect(state.name).toBe("my-task");
    expect(state.prompt).toBe("convert to ts");
    expect(state.engine).toBe("claude");
    expect(state.model).toBe("opus");
    expect(state.status).toBe("active");
    expect(state.history).toEqual([]);
    expect(state.usage.total_cost_usd).toBe(0);
  });

  test("respects custom engine and model", () => {
    const state = buildInitialState({
      name: "t",
      prompt: "p",
      engine: "codex",
      model: "sonnet",
    });
    expect(state.engine).toBe("codex");
    expect(state.model).toBe("sonnet");
  });

  test("sets createdAt and lastModified to ISO timestamps", () => {
    const state = buildInitialState({ name: "t", prompt: "p" });
    expect(() => new Date(state.createdAt)).not.toThrow();
    expect(() => new Date(state.lastModified)).not.toThrow();
  });
});

describe("ensureState", () => {
  test("returns existing state when .ralph-state.json exists", () =>
    withStorage(() => {
      const original = buildInitialState({ name: "existing", prompt: "p" });
      writeState(tempDir, original);
      const state = ensureState(tempDir);
      expect(state.name).toBe("existing");
    }));

  test("initialises fresh state when no .ralph-state.json exists", () =>
    withStorage(() => {
      const state = ensureState(tempDir);
      expect(state.status).toBe("active");
      expect(existsSync(join(tempDir, ".ralph-state.json"))).toBe(true);
    }));
});
