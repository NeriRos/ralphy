import { describe, test, expect, beforeEach } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadPhases,
  getPhase,
  getPhaseOrder,
  getNextPhase,
  getFirstPhase,
  clearPhaseCache,
  resolveChecklistDir,
  listChecklists,
} from "./phases";
import { resolveScaffoldsDir, resolveTasksDir } from "@ralphy/content";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "phases-test-"));
}

function writePhase(dir: string, filename: string, frontmatter: string, body: string = ""): void {
  writeFileSync(join(dir, filename), `---\n${frontmatter}\n---\n${body}`);
}

beforeEach(() => {
  clearPhaseCache();
});

describe("loadPhases", () => {
  test("loads and sorts phases by order", () => {
    const dir = makeTempDir();
    writePhase(dir, "b.md", "name: plan\norder: 2\nterminal: false");
    writePhase(dir, "a.md", "name: research\norder: 1\nterminal: false");
    writePhase(dir, "c.md", "name: done\norder: 99\nterminal: true");

    const phases = loadPhases(dir);
    expect(phases.map((p) => p.name)).toEqual(["research", "plan", "done"]);
  });

  test("parses frontmatter fields correctly", () => {
    const dir = makeTempDir();
    writePhase(
      dir,
      "exec.md",
      [
        "name: exec",
        "order: 3",
        "requires:",
        "  - PLAN.md",
        "  - PROGRESS.md",
        "next: review",
        "autoAdvance: allChecked",
        "loopBack: null",
        "terminal: false",
        "context:",
        '  - {type: currentSection, label: "Current Section"}',
      ].join("\n"),
      "\n# Exec\n\nDo the work.",
    );

    const phases = loadPhases(dir);
    const exec = phases[0]!;
    expect(exec.name).toBe("exec");
    expect(exec.order).toBe(3);
    expect(exec.requires).toEqual(["PLAN.md", "PROGRESS.md"]);
    expect(exec.next).toBe("review");
    expect(exec.autoAdvance).toBe("allChecked");
    expect(exec.loopBack).toBeNull();
    expect(exec.terminal).toBe(false);
    expect(exec.prompt).toContain("Do the work.");
  });

  test("applies defaults for missing optional fields", () => {
    const dir = makeTempDir();
    writePhase(dir, "simple.md", "name: simple\norder: 1");

    const phases = loadPhases(dir);
    const phase = phases[0]!;
    expect(phase.requires).toEqual([]);
    expect(phase.next).toBeNull();
    expect(phase.autoAdvance).toBeNull();
    expect(phase.loopBack).toBeNull();
    expect(phase.terminal).toBe(false);
    expect(phase.context).toEqual([]);
  });

  test("returns cached result on subsequent calls", () => {
    const dir = makeTempDir();
    writePhase(dir, "a.md", "name: a\norder: 1");

    const first = loadPhases(dir);
    const second = loadPhases(dir);
    expect(first).toBe(second); // same reference
  });

  test("reloads when dir changes", () => {
    const dir1 = makeTempDir();
    const dir2 = makeTempDir();
    writePhase(dir1, "a.md", "name: a\norder: 1");
    writePhase(dir2, "b.md", "name: b\norder: 1");

    const first = loadPhases(dir1);
    const second = loadPhases(dir2);
    expect(first[0]!.name).toBe("a");
    expect(second[0]!.name).toBe("b");
  });

  test("skips non-.md files", () => {
    const dir = makeTempDir();
    writePhase(dir, "a.md", "name: a\norder: 1");
    writeFileSync(join(dir, "readme.txt"), "not a phase");

    const phases = loadPhases(dir);
    expect(phases).toHaveLength(1);
  });

  test("throws on invalid frontmatter", () => {
    const dir = makeTempDir();
    writePhase(dir, "bad.md", "order: 1"); // missing required 'name'

    expect(() => loadPhases(dir)).toThrow();
  });

  test("loads the real lib/ phases", () => {
    const phases = loadPhases();
    expect(phases.length).toBeGreaterThanOrEqual(6);
    expect(phases[0]!.name).toBe("specify");
    expect(phases[phases.length - 1]!.terminal).toBe(true);
  });
});

describe("getPhase", () => {
  test("returns the requested phase", () => {
    const dir = makeTempDir();
    writePhase(dir, "a.md", "name: alpha\norder: 1");
    writePhase(dir, "b.md", "name: beta\norder: 2");

    const phase = getPhase("beta", dir);
    expect(phase.name).toBe("beta");
    expect(phase.order).toBe(2);
  });

  test("throws for unknown phase", () => {
    const dir = makeTempDir();
    writePhase(dir, "a.md", "name: alpha\norder: 1");

    expect(() => getPhase("nope", dir)).toThrow("Unknown phase");
  });
});

describe("getPhaseOrder", () => {
  test("returns names in order", () => {
    const dir = makeTempDir();
    writePhase(dir, "c.md", "name: c\norder: 3");
    writePhase(dir, "a.md", "name: a\norder: 1");
    writePhase(dir, "b.md", "name: b\norder: 2");

    expect(getPhaseOrder(dir)).toEqual(["a", "b", "c"]);
  });
});

describe("getNextPhase", () => {
  test("returns next by order when no explicit next", () => {
    const dir = makeTempDir();
    writePhase(dir, "a.md", "name: a\norder: 1");
    writePhase(dir, "b.md", "name: b\norder: 2");
    writePhase(dir, "c.md", "name: c\norder: 3");

    expect(getNextPhase("a", dir)).toBe("b");
    expect(getNextPhase("b", dir)).toBe("c");
  });

  test("returns null for last phase", () => {
    const dir = makeTempDir();
    writePhase(dir, "a.md", "name: a\norder: 1");
    writePhase(dir, "b.md", "name: b\norder: 2");

    expect(getNextPhase("b", dir)).toBeNull();
  });

  test("uses explicit next override", () => {
    const dir = makeTempDir();
    writePhase(dir, "a.md", "name: a\norder: 1\nnext: c");
    writePhase(dir, "b.md", "name: b\norder: 2");
    writePhase(dir, "c.md", "name: c\norder: 3");

    expect(getNextPhase("a", dir)).toBe("c");
  });

  test("throws for unknown phase", () => {
    const dir = makeTempDir();
    writePhase(dir, "a.md", "name: a\norder: 1");

    expect(() => getNextPhase("nope", dir)).toThrow("Unknown current phase");
  });
});

describe("getFirstPhase", () => {
  test("returns the phase with lowest order", () => {
    const dir = makeTempDir();
    writePhase(dir, "z.md", "name: z\norder: 99");
    writePhase(dir, "a.md", "name: a\norder: 1");
    writePhase(dir, "m.md", "name: m\norder: 50");

    expect(getFirstPhase(dir).name).toBe("a");
  });
});

describe("clearPhaseCache", () => {
  test("forces reload on next call", () => {
    const dir = makeTempDir();
    writePhase(dir, "a.md", "name: a\norder: 1");

    const first = loadPhases(dir);
    clearPhaseCache();

    // Add another file
    writePhase(dir, "b.md", "name: b\norder: 2");
    const second = loadPhases(dir);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(2);
  });
});

describe("real phase files", () => {
  test("specify phase has correct config", () => {
    const phase = getPhase("specify");
    expect(phase.order).toBe(0);
    expect(phase.next).toBe("research");
    expect(phase.terminal).toBe(false);
    expect(phase.requires).toEqual([]);
    expect(phase.prompt).toContain("Specify Phase");
  });

  test("research phase has correct config", () => {
    const phase = getPhase("research");
    expect(phase.order).toBe(1);
    expect(phase.next).toBe("plan");
    expect(phase.terminal).toBe(false);
    expect(phase.requires).toEqual(["spec.md"]);
    expect(phase.prompt).toContain("Research Phase");
  });

  test("plan phase requires RESEARCH.md and has file context", () => {
    const phase = getPhase("plan");
    expect(phase.order).toBe(2);
    expect(phase.requires).toEqual(["RESEARCH.md"]);
    expect(phase.context).toEqual([
      { type: "file", file: "RESEARCH.md", label: "Research Findings" },
      { type: "file", file: "spec.md", label: "Specification" },
    ]);
  });

  test("exec phase requires PLAN.md and PROGRESS.md", () => {
    const phase = getPhase("exec");
    expect(phase.order).toBe(3);
    expect(phase.requires).toEqual(["PLAN.md", "PROGRESS.md"]);
    expect(phase.autoAdvance).toBe("allChecked");
    expect(phase.next).toBe("review");
    expect(phase.context).toEqual([{ type: "currentSection", label: "Current Section" }]);
  });

  test("review phase has loopBack to exec and spec context", () => {
    const phase = getPhase("review");
    expect(phase.order).toBe(4);
    expect(phase.loopBack).toBe("exec");
    expect(phase.next).toBe("exec");
    expect(phase.autoAdvance).toBe("allChecked");
    expect(phase.context).toEqual([
      { type: "currentSection", label: "Current Section (to review)" },
      { type: "file", file: "spec.md", label: "Specification (requirements to validate against)" },
    ]);
  });

  test("done phase is terminal", () => {
    const phase = getPhase("done");
    expect(phase.order).toBe(99);
    expect(phase.terminal).toBe(true);
  });

  test("phase order is specify → research → plan → exec → review → done", () => {
    expect(getPhaseOrder()).toEqual(["specify", "research", "plan", "exec", "review", "done"]);
  });

  test("full transition chain works", () => {
    expect(getNextPhase("specify")).toBe("research");
    expect(getNextPhase("research")).toBe("plan");
    expect(getNextPhase("plan")).toBe("exec");
    expect(getNextPhase("exec")).toBe("review");
    expect(getNextPhase("review")).toBe("exec"); // explicit next override
    expect(getNextPhase("done")).toBeNull(); // terminal, no next
  });
});

describe("resolveChecklistDir", () => {
  test("returns a path ending in /checklists", () => {
    const dir = resolveChecklistDir();
    expect(dir).toMatch(/checklists$/);
  });

  test("points to an existing directory", () => {
    const { existsSync } = require("node:fs");
    expect(existsSync(resolveChecklistDir())).toBe(true);
  });
});

describe("listChecklists", () => {
  test("returns an array of checklist names without .md extension", () => {
    const names = listChecklists();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name).not.toMatch(/\.md$/);
    }
  });
});

describe("@ralphy/content helpers (transitive)", () => {
  test("resolveScaffoldsDir returns an existing scaffolds path", () => {
    const dir = resolveScaffoldsDir();
    expect(dir).toMatch(/scaffolds$/);
    expect(existsSync(dir)).toBe(true);
  });

  test("resolveTasksDir returns an existing tasks path", () => {
    const dir = resolveTasksDir();
    expect(dir).toMatch(/tasks$/);
    expect(existsSync(dir)).toBe(true);
  });
});
