import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  readState,
  writeState,
  updateState,
  buildInitialState,
  migrateState,
  ensureState,
} from "../state";
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
      expect(read.phase).toBe("specify");
      expect(read.version).toBe("1");
    }));

  test("throws when state.json is missing", () =>
    withStorage(() => {
      expect(() => readState(tempDir)).toThrow();
    }));

  test("throws when state.json contains invalid JSON", () =>
    withStorage(() => {
      writeFileSync(join(tempDir, "state.json"), "not json", "utf-8");
      expect(() => readState(tempDir)).toThrow();
    }));

  test("atomic write does not leave tmp file on success", () =>
    withStorage(() => {
      const state = buildInitialState({ name: "test", prompt: "p" });
      writeState(tempDir, state);
      expect(existsSync(join(tempDir, "state.json.tmp"))).toBe(false);
      expect(existsSync(join(tempDir, "state.json"))).toBe(true);
    }));

  test("written file is valid JSON with trailing newline", () =>
    withStorage(() => {
      const state = buildInitialState({ name: "test", prompt: "p" });
      writeState(tempDir, state);
      const raw = readFileSync(join(tempDir, "state.json"), "utf-8");
      expect(raw.endsWith("\n")).toBe(true);
      expect(() => JSON.parse(raw)).not.toThrow();
    }));
});

describe("updateState", () => {
  test("applies updater function and persists", () =>
    withStorage(() => {
      const state = buildInitialState({ name: "test", prompt: "p" });
      writeState(tempDir, state);

      const updated = updateState(tempDir, (s) => ({
        ...s,
        phase: "plan",
        phaseIteration: 1,
      }));

      expect(updated.phase).toBe("plan");
      expect(updated.phaseIteration).toBe(1);

      // Verify persisted
      const reread = readState(tempDir);
      expect(reread.phase).toBe("plan");
    }));
});

describe("buildInitialState", () => {
  test("creates state with required fields", () => {
    const state = buildInitialState({ name: "my-task", prompt: "convert to ts" });
    expect(state.name).toBe("my-task");
    expect(state.prompt).toBe("convert to ts");
    expect(state.phase).toBe("specify");
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

  test("respects custom phase", () => {
    const state = buildInitialState({ name: "t", prompt: "p", phase: "exec" });
    expect(state.phase).toBe("exec");
  });

  test("sets createdAt and lastModified to ISO timestamps", () => {
    const state = buildInitialState({ name: "t", prompt: "p" });
    expect(() => new Date(state.createdAt)).not.toThrow();
    expect(() => new Date(state.lastModified)).not.toThrow();
  });
});

describe("migrateState", () => {
  test("infers specify phase when no files exist", () =>
    withStorage(() => {
      const state = migrateState(tempDir);
      expect(state.phase).toBe("specify");
      expect(existsSync(join(tempDir, "state.json"))).toBe(true);
    }));

  test("infers research phase when only spec.md exists", () =>
    withStorage(() => {
      writeFileSync(join(tempDir, "spec.md"), "# Spec", "utf-8");
      const state = migrateState(tempDir);
      expect(state.phase).toBe("research");
    }));

  test("infers plan phase when spec.md and RESEARCH.md exist", () =>
    withStorage(() => {
      writeFileSync(join(tempDir, "spec.md"), "# Spec", "utf-8");
      writeFileSync(join(tempDir, "RESEARCH.md"), "# Research", "utf-8");
      const state = migrateState(tempDir);
      expect(state.phase).toBe("plan");
    }));

  test("infers exec phase when PROGRESS.md has unchecked items", () =>
    withStorage(() => {
      writeFileSync(join(tempDir, "spec.md"), "# Spec", "utf-8");
      writeFileSync(join(tempDir, "RESEARCH.md"), "# Research", "utf-8");
      writeFileSync(join(tempDir, "PLAN.md"), "# Plan", "utf-8");
      writeFileSync(
        join(tempDir, "PROGRESS.md"),
        "## Section 1\n- [x] Done\n- [ ] Todo\n",
        "utf-8",
      );
      const state = migrateState(tempDir);
      expect(state.phase).toBe("exec");
    }));

  test("infers done phase when PROGRESS.md has no unchecked items", () =>
    withStorage(() => {
      writeFileSync(join(tempDir, "spec.md"), "# Spec", "utf-8");
      writeFileSync(join(tempDir, "RESEARCH.md"), "# Research", "utf-8");
      writeFileSync(join(tempDir, "PLAN.md"), "# Plan", "utf-8");
      writeFileSync(
        join(tempDir, "PROGRESS.md"),
        "## Section 1\n- [x] Done\n- [x] Also done\n",
        "utf-8",
      );
      const state = migrateState(tempDir);
      expect(state.phase).toBe("done");
    }));
});

describe("ensureState", () => {
  test("returns existing state when state.json exists", () =>
    withStorage(() => {
      const original = buildInitialState({ name: "existing", prompt: "p" });
      writeState(tempDir, original);
      const state = ensureState(tempDir);
      expect(state.name).toBe("existing");
    }));

  test("migrates when task files exist but no state.json", () =>
    withStorage(() => {
      writeFileSync(join(tempDir, "RESEARCH.md"), "# Research", "utf-8");
      const state = ensureState(tempDir);
      expect(state.phase).toBe("plan");
      expect(existsSync(join(tempDir, "state.json"))).toBe(true);
    }));

  test("initialises fresh when no files exist", () =>
    withStorage(() => {
      const state = ensureState(tempDir);
      expect(state.phase).toBe("specify");
      expect(existsSync(join(tempDir, "state.json"))).toBe(true);
    }));
});
