import { resolve } from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import fm from "front-matter";
import { type PhaseConfig, PhaseFrontmatterSchema } from "@ralphy/types";
import { resolvePhasesDir as contentPhasesDir, resolveChecklistsDir } from "@ralphy/content";

let cachedPhases: PhaseConfig[] | null = null;
let cachedDir: string | null = null;

/**
 * Load all phase files from a directory, parse frontmatter with Zod, return sorted PhaseConfig[].
 * Defaults to the @ralphy/content phases directory.
 */
export function loadPhases(dir: string = contentPhasesDir()): PhaseConfig[] {
  if (cachedPhases !== null && cachedDir === dir) return cachedPhases;

  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  const phases: PhaseConfig[] = [];

  for (const file of files) {
    const content = readFileSync(resolve(dir, file), "utf-8");
    const { attributes, body } = fm<Record<string, unknown>>(content);
    const config = PhaseFrontmatterSchema.parse(attributes);
    phases.push({ ...config, prompt: body.trim() });
  }

  phases.sort((a, b) => a.order - b.order);
  cachedPhases = phases;
  cachedDir = dir;
  return phases;
}

/**
 * Get a single phase config by name.
 */
export function getPhase(name: string, dir?: string): PhaseConfig {
  const phases = loadPhases(dir);
  const phase = phases.find((p) => p.name === name);
  if (!phase) throw new Error("Unknown phase");
  return phase;
}

/**
 * Get phase names in order.
 */
export function getPhaseOrder(dir?: string): string[] {
  return loadPhases(dir).map((p) => p.name);
}

/**
 * Resolve the next phase from the current one.
 * Uses the `next` override if set, otherwise the next phase by order.
 */
export function getNextPhase(current: string, dir?: string): string | null {
  const phases = loadPhases(dir);
  const phase = phases.find((p) => p.name === current);
  if (!phase) throw new Error("Unknown current phase");

  if (phase.next) {
    return phase.next;
  }

  const idx = phases.indexOf(phase);
  if (idx < phases.length - 1) {
    return phases[idx + 1]!.name;
  }

  return null;
}

/**
 * Get the first phase (lowest order).
 */
export function getFirstPhase(dir?: string): PhaseConfig {
  const phases = loadPhases(dir);
  return phases[0]!;
}

/**
 * Clear the cached phases (useful for testing).
 */
export function clearPhaseCache(): void {
  cachedPhases = null;
  cachedDir = null;
}

/**
 * Resolve the absolute path to the checklists directory.
 */
export function resolveChecklistDir(): string {
  return resolveChecklistsDir();
}

/**
 * List available checklist names (without .md extension).
 */
export function listChecklists(): string[] {
  const dir = resolveChecklistsDir();
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}
