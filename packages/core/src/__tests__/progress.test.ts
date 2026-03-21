import { describe, expect, test } from "bun:test";
import { extractCurrentSection, countProgress, parseProgressItems } from "../progress";

const SAMPLE_PROGRESS = `# Progress — typescript

## Section 1 — Scaffolding

- [x] Initialize workspace
- [x] Run bun install

## Section 2 — Types

- [x] Create types.ts
- [x] Write tests

## Section 3 — State Management

- [ ] Create state.ts
- [ ] Create progress.ts
- [ ] Write tests

## Section 4 — Git Operations

- [ ] Create git.ts
- [ ] Create display.ts
`;

describe("extractCurrentSection", () => {
  test("returns the first section with unchecked items", () => {
    const result = extractCurrentSection(SAMPLE_PROGRESS);
    expect(result).not.toBeNull();
    expect(result).toContain("## Section 3 — State Management");
    expect(result).toContain("- [ ] Create state.ts");
  });

  test("skips fully checked sections", () => {
    const result = extractCurrentSection(SAMPLE_PROGRESS);
    expect(result).not.toContain("## Section 1");
    expect(result).not.toContain("## Section 2");
  });

  test("returns null when all items are checked", () => {
    const allDone = `## Section 1\n- [x] Done\n- [x] Also done\n`;
    expect(extractCurrentSection(allDone)).toBeNull();
  });

  test("returns null for empty content", () => {
    expect(extractCurrentSection("")).toBeNull();
  });

  test("returns null when there are no sections", () => {
    expect(extractCurrentSection("Just some text\nNo sections")).toBeNull();
  });

  test("handles a single section with unchecked items", () => {
    const single = `## Only Section\n- [ ] Todo item\n`;
    const result = extractCurrentSection(single);
    expect(result).toContain("## Only Section");
    expect(result).toContain("- [ ] Todo item");
  });

  test("handles mixed checked and unchecked in a section", () => {
    const mixed = `## Section\n- [x] Done\n- [ ] Not done\n- [x] Also done\n`;
    const result = extractCurrentSection(mixed);
    expect(result).toContain("## Section");
    expect(result).toContain("- [ ] Not done");
    expect(result).toContain("- [x] Done");
  });

  test("returns first unchecked section when multiple have unchecked items", () => {
    const result = extractCurrentSection(SAMPLE_PROGRESS);
    // Should be Section 3, not Section 4
    expect(result).toContain("## Section 3");
    expect(result).not.toContain("## Section 4");
  });
});

describe("countProgress", () => {
  test("counts checked and unchecked items", () => {
    const result = countProgress(SAMPLE_PROGRESS);
    expect(result.checked).toBe(4);
    expect(result.unchecked).toBe(5);
    expect(result.total).toBe(9);
  });

  test("returns zeros for empty content", () => {
    const result = countProgress("");
    expect(result).toEqual({ checked: 0, unchecked: 0, total: 0 });
  });

  test("counts only checked when all done", () => {
    const allDone = "- [x] A\n- [x] B\n- [x] C\n";
    const result = countProgress(allDone);
    expect(result).toEqual({ checked: 3, unchecked: 0, total: 3 });
  });

  test("counts only unchecked when none done", () => {
    const noneDone = "- [ ] A\n- [ ] B\n";
    const result = countProgress(noneDone);
    expect(result).toEqual({ checked: 0, unchecked: 2, total: 2 });
  });

  test("ignores non-checklist lines", () => {
    const mixed = "# Title\nSome text\n- [x] Done\n- [ ] Todo\nMore text\n";
    const result = countProgress(mixed);
    expect(result).toEqual({ checked: 1, unchecked: 1, total: 2 });
  });
});

describe("parseProgressItems", () => {
  test("parses items with section context", () => {
    const items = parseProgressItems(SAMPLE_PROGRESS);
    expect(items).toEqual([
      { text: "Initialize workspace", checked: true, section: "Section 1 — Scaffolding" },
      { text: "Run bun install", checked: true, section: "Section 1 — Scaffolding" },
      { text: "Create types.ts", checked: true, section: "Section 2 — Types" },
      { text: "Write tests", checked: true, section: "Section 2 — Types" },
      { text: "Create state.ts", checked: false, section: "Section 3 — State Management" },
      { text: "Create progress.ts", checked: false, section: "Section 3 — State Management" },
      { text: "Write tests", checked: false, section: "Section 3 — State Management" },
      { text: "Create git.ts", checked: false, section: "Section 4 — Git Operations" },
      { text: "Create display.ts", checked: false, section: "Section 4 — Git Operations" },
    ]);
  });

  test("returns empty array for empty content", () => {
    expect(parseProgressItems("")).toEqual([]);
  });

  test("handles items without sections", () => {
    const items = parseProgressItems("- [x] Done\n- [ ] Todo\n");
    expect(items).toEqual([
      { text: "Done", checked: true, section: "" },
      { text: "Todo", checked: false, section: "" },
    ]);
  });
});
