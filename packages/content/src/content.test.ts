import { describe, test, expect } from "bun:test";
import { existsSync } from "node:fs";
import {
  resolveScaffoldsDir,
  resolveTasksDir,
  resolvePhasesDir,
  resolveChecklistsDir,
} from "./content";

describe("content path resolvers", () => {
  test("resolveScaffoldsDir returns a path ending in /scaffolds", () => {
    const dir = resolveScaffoldsDir();
    expect(dir).toMatch(/scaffolds$/);
    expect(existsSync(dir)).toBe(true);
  });

  test("resolveTasksDir returns a path ending in /tasks", () => {
    const dir = resolveTasksDir();
    expect(dir).toMatch(/tasks$/);
    expect(existsSync(dir)).toBe(true);
  });

  test("resolvePhasesDir returns a path ending in /phases", () => {
    const dir = resolvePhasesDir();
    expect(dir).toMatch(/phases$/);
    expect(existsSync(dir)).toBe(true);
  });

  test("resolveChecklistsDir returns a path ending in /checklists", () => {
    const dir = resolveChecklistsDir();
    expect(dir).toMatch(/checklists$/);
    expect(existsSync(dir)).toBe(true);
  });
});
