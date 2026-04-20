import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildTaskPrompt, extractFirstUncheckedSection } from "../loop";
import { buildInitialState, writeState } from "../state";
import { runWithContext, createDefaultContext } from "@ralphy/context";
import type { State } from "@ralphy/types";

let tempDir: string;
const withStorage = <T>(fn: () => T): T => runWithContext(createDefaultContext(), fn);

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "core-loop-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function makeState(): State {
  return buildInitialState({ name: "demo-change", prompt: "Demo prompt" });
}

describe("buildTaskPrompt", () => {
  test("includes steering content from steering.md when present", () =>
    withStorage(() => {
      const state = makeState();
      writeState(tempDir, state);
      writeFileSync(
        join(tempDir, "steering.md"),
        "Follow convention X\nAvoid pattern Y\n",
        "utf-8",
      );

      const prompt = buildTaskPrompt(state, tempDir);
      expect(prompt).toContain("User Steering");
      expect(prompt).toContain("Follow convention X");
      expect(prompt).toContain("Avoid pattern Y");
    }));

  test("includes first unchecked task section from tasks.md", () =>
    withStorage(() => {
      const state = makeState();
      writeState(tempDir, state);
      writeFileSync(
        join(tempDir, "tasks.md"),
        [
          "## 1. Setup",
          "- [x] Done item",
          "",
          "## 2. Implementation",
          "- [ ] Write code",
          "- [ ] Add tests",
          "",
          "## 3. Finish",
          "- [ ] Wrap up",
        ].join("\n"),
        "utf-8",
      );

      const prompt = buildTaskPrompt(state, tempDir);
      expect(prompt).toContain("Current Task Section");
      expect(prompt).toContain("## 2. Implementation");
      expect(prompt).toContain("Write code");
      expect(prompt).not.toContain("## 3. Finish");
    }));

  test("omits steering block when steering.md is absent", () =>
    withStorage(() => {
      const state = makeState();
      writeState(tempDir, state);

      const prompt = buildTaskPrompt(state, tempDir);
      expect(prompt).not.toContain("User Steering");
    }));
});

describe("extractFirstUncheckedSection", () => {
  test("returns null when every section is fully checked", () => {
    const content = "## Alpha\n- [x] one\n\n## Beta\n- [x] two\n";
    expect(extractFirstUncheckedSection(content)).toBeNull();
  });

  test("returns the first section containing an unchecked item", () => {
    const content = "## Alpha\n- [x] one\n\n## Beta\n- [ ] two\n\n## Gamma\n- [ ] three\n";
    const section = extractFirstUncheckedSection(content);
    expect(section).not.toBeNull();
    expect(section).toContain("## Beta");
    expect(section).not.toContain("## Gamma");
  });
});
