import { describe, expect, test } from "bun:test";
import {
  getTaskDocuments,
  getDocumentNames,
  getScaffoldDocuments,
  getStatusDocuments,
  getPromptDocuments,
} from "../documents";

describe("getTaskDocuments", () => {
  test("returns a non-empty readonly array", () => {
    const docs = getTaskDocuments();
    expect(docs.length).toBeGreaterThan(0);
  });

  test("each document has required fields", () => {
    for (const doc of getTaskDocuments()) {
      expect(typeof doc.name).toBe("string");
      expect(doc.name.length).toBeGreaterThan(0);
      expect(typeof doc.showInStatus).toBe("boolean");
    }
  });
});

describe("getDocumentNames", () => {
  test("returns an array of strings", () => {
    const names = getDocumentNames();
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(typeof name).toBe("string");
    }
  });

  test("includes known document names", () => {
    const names = getDocumentNames();
    expect(names).toContain("STEERING.md");
    expect(names).toContain("RESEARCH.md");
  });
});

describe("getScaffoldDocuments", () => {
  test("returns only documents with scaffold !== null", () => {
    const docs = getScaffoldDocuments();
    expect(docs.length).toBeGreaterThan(0);
    for (const doc of docs) {
      expect(doc.scaffold).not.toBeNull();
    }
  });

  test("includes STEERING.md", () => {
    const names = getScaffoldDocuments().map((d) => d.name);
    expect(names).toContain("STEERING.md");
  });
});

describe("getStatusDocuments", () => {
  test("returns only documents with showInStatus === true", () => {
    const docs = getStatusDocuments();
    expect(docs.length).toBeGreaterThan(0);
    for (const doc of docs) {
      expect(doc.showInStatus).toBe(true);
    }
  });

  test("includes RESEARCH.md, PLAN.md, PROGRESS.md", () => {
    const names = getStatusDocuments().map((d) => d.name);
    expect(names).toContain("RESEARCH.md");
    expect(names).toContain("PLAN.md");
    expect(names).toContain("PROGRESS.md");
  });
});

describe("getPromptDocuments", () => {
  test("returns STEERING.md for any phase (phases='all')", () => {
    const docs = getPromptDocuments("research");
    const names = docs.map((d) => d.name);
    expect(names).toContain("STEERING.md");
  });

  test("returns MANUAL_TESTING.md for exec phase", () => {
    const docs = getPromptDocuments("exec");
    const names = docs.map((d) => d.name);
    expect(names).toContain("MANUAL_TESTING.md");
  });

  test("returns MANUAL_TESTING.md for review phase", () => {
    const docs = getPromptDocuments("review");
    const names = docs.map((d) => d.name);
    expect(names).toContain("MANUAL_TESTING.md");
  });

  test("does not return MANUAL_TESTING.md for research phase", () => {
    const docs = getPromptDocuments("research");
    const names = docs.map((d) => d.name);
    expect(names).not.toContain("MANUAL_TESTING.md");
  });

  test("does not return documents with promptInjection=null", () => {
    const docs = getPromptDocuments("exec");
    const names = docs.map((d) => d.name);
    expect(names).not.toContain("RESEARCH.md");
    expect(names).not.toContain("PLAN.md");
    expect(names).not.toContain("PROGRESS.md");
  });

  test("returns INTERACTIVE.md for any phase", () => {
    const docs = getPromptDocuments("plan");
    const names = docs.map((d) => d.name);
    expect(names).toContain("INTERACTIVE.md");
  });
});
