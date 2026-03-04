import { resolve, dirname } from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import fm from "front-matter";
import { type PhaseConfig, PhaseFrontmatterSchema } from "@ralphy/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultPhasesDir = resolve(__dirname, "..", "phases");
const defaultChecklistDir = resolve(__dirname, "..", "checklists");

// When bundled (installed), paths resolve through ../templates/ instead
// Detect by checking if the default dir exists, fall back to bundled layout
function resolvePhasesDir(): string {
  try {
    readdirSync(defaultPhasesDir);
    return defaultPhasesDir;
  } catch {
    return resolve(__dirname, "..", "phases");
  }
}

function resolveChecklistDirPath(): string {
  try {
    readdirSync(defaultChecklistDir);
    return defaultChecklistDir;
  } catch {
    return resolve(__dirname, "..", "templates", "checklists");
  }
}

let cachedPhases: PhaseConfig[] | null = null;
let cachedDir: string | null = null;

/**
 * Load all phase files from a directory, parse frontmatter with Zod, return sorted PhaseConfig[].
 * Defaults to the lib/ directory (co-located .md files).
 */
export function loadPhases(dir: string = resolvePhasesDir()): PhaseConfig[] {
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
  if (!phase) throw new Error(`Unknown phase: ${name}`);
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
  if (!phase) throw new Error(`Unknown phase: ${current}`);

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
  return resolveChecklistDirPath();
}

/**
 * List available checklist names (without .md extension).
 */
export function listChecklists(): string[] {
  const dir = resolveChecklistDirPath();
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}
