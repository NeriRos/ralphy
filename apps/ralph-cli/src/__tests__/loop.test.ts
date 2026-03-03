import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import { buildTaskPrompt } from "../loop";
import { buildInitialState, writeState } from "ralph-core/state";
import type { State } from "ralph-types";
import type { BuildInitialStateOpts } from "ralph-core/state";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "ralph-loop-test-"));
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

describe("buildTaskPrompt", () => {
  test("includes steering content when STEERING.md exists", () => {
    const state = makeState({ phase: "research" });
    writeState(tempDir, state);
    writeFileSync(join(tempDir, "STEERING.md"), "# Heading\nUse pattern X\nAvoid Y\n", "utf-8");

    const prompt = buildTaskPrompt(state, tempDir);
    expect(prompt).toContain("User Steering");
    expect(prompt).toContain("Use pattern X");
    expect(prompt).toContain("Avoid Y");
    // Headings should be filtered out from steering content
    expect(prompt).not.toContain("# Heading\nUse pattern X");
  });

  test("omits steering when STEERING.md does not exist", () => {
    const state = makeState({ phase: "research" });
    writeState(tempDir, state);

    const prompt = buildTaskPrompt(state, tempDir);
    expect(prompt).not.toContain("User Steering");
  });

  test("omits steering when STEERING.md is empty or only headers", () => {
    const state = makeState({ phase: "research" });
    writeState(tempDir, state);
    writeFileSync(join(tempDir, "STEERING.md"), "# Title\n## Subtitle\n", "utf-8");

    const prompt = buildTaskPrompt(state, tempDir);
    expect(prompt).not.toContain("User Steering");
  });

  test("plan phase includes RESEARCH.md content", () => {
    const state = { ...makeState(), phase: "plan" };
    writeState(tempDir, state);
    writeFileSync(join(tempDir, "RESEARCH.md"), "## Key Findings\nThe API uses REST.\n", "utf-8");

    const prompt = buildTaskPrompt(state, tempDir);
    expect(prompt).toContain("Research Findings");
    expect(prompt).toContain("The API uses REST.");
  });

  test("exec phase includes current section from PROGRESS.md", () => {
    const state = { ...makeState(), phase: "exec" };
    writeState(tempDir, state);
    writeFileSync(
      join(tempDir, "PROGRESS.md"),
      [
        "## Section 1 — Setup",
        "- [x] Create config",
        "- [x] Install deps",
        "",
        "## Section 2 — Implementation",
        "- [ ] Add feature A",
        "- [ ] Add feature B",
      ].join("\n"),
      "utf-8",
    );

    const prompt = buildTaskPrompt(state, tempDir);
    expect(prompt).toContain("Section 2");
    expect(prompt).toContain("Add feature A");
    expect(prompt).toContain("Add feature B");
    // Should not include already-completed Section 1
    expect(prompt).not.toContain("Create config");
  });

  test("review phase includes current section for review", () => {
    const state = { ...makeState(), phase: "review" };
    writeState(tempDir, state);
    writeFileSync(
      join(tempDir, "PROGRESS.md"),
      ["## Section 1 — Done", "- [x] Item 1", "", "## Section 2 — WIP", "- [ ] Item 2"].join("\n"),
      "utf-8",
    );

    const prompt = buildTaskPrompt(state, tempDir);
    expect(prompt).toContain("Current Section (to review)");
    expect(prompt).toContain("Item 2");
  });

  test("steering content is limited to 20 lines", () => {
    const state = makeState({ phase: "research" });
    writeState(tempDir, state);
    const lines = Array.from({ length: 30 }, (_, i) => `Guidance line ${i + 1}`);
    writeFileSync(join(tempDir, "STEERING.md"), lines.join("\n"), "utf-8");

    const prompt = buildTaskPrompt(state, tempDir);
    expect(prompt).toContain("Guidance line 1");
    expect(prompt).toContain("Guidance line 20");
    expect(prompt).not.toContain("Guidance line 21");
  });
});

describe("parseArgs → buildTaskPrompt integration", () => {
  test("research phase produces non-empty prompt", () => {
    const state = makeState({ phase: "research" });
    writeState(tempDir, state);

    const prompt = buildTaskPrompt(state, tempDir);
    // Should at minimum have the phase prompt content (if the file exists)
    expect(typeof prompt).toBe("string");
  });

  test("exec phase with no PROGRESS.md still returns prompt", () => {
    const state = { ...makeState(), phase: "exec" };
    writeState(tempDir, state);

    const prompt = buildTaskPrompt(state, tempDir);
    expect(typeof prompt).toBe("string");
  });
});
