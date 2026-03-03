import { join } from "node:path";
import { execSync } from "node:child_process";
import { StateSchema, type State, type Phase } from "@ralphy/types";
import { getStorage } from "@ralphy/context";

const STATE_FILE = "state.json";

/**
 * Read and parse state.json from a task directory.
 */
export function readState(taskDir: string): State {
  const filePath = join(taskDir, STATE_FILE);
  const raw = getStorage().read(filePath);
  if (raw === null) throw new Error(`state.json not found in ${taskDir}`);
  return StateSchema.parse(JSON.parse(raw));
}

/**
 * Write state.json to a task directory.
 */
export function writeState(taskDir: string, state: State): void {
  const filePath = join(taskDir, STATE_FILE);
  getStorage().write(filePath, JSON.stringify(state, null, 2) + "\n");
}

/**
 * Read state, apply an updater function, and write back.
 */
export function updateState(taskDir: string, updater: (state: State) => State): State {
  const state = readState(taskDir);
  const updated = updater(state);
  writeState(taskDir, updated);
  return updated;
}

export interface BuildInitialStateOpts {
  name: string;
  prompt: string;
  engine?: string;
  model?: string;
  phase?: Phase;
}

/**
 * Build a fresh State object with sensible defaults.
 */
export function buildInitialState(opts: BuildInitialStateOpts): State {
  const now = new Date().toISOString();
  let branch = "main";
  try {
    branch = execSync("git branch --show-current", { encoding: "utf-8" }).trim();
  } catch {
    // not in a git repo — use default
  }

  return StateSchema.parse({
    name: opts.name,
    prompt: opts.prompt,
    phase: opts.phase ?? "research",
    engine: opts.engine ?? "claude",
    model: opts.model ?? "opus",
    createdAt: now,
    lastModified: now,
    metadata: { branch },
  });
}

/**
 * Infer the current phase from files present in a task directory.
 */
function inferPhaseFromFiles(taskDir: string): Phase {
  const storage = getStorage();
  if (storage.read(join(taskDir, "RESEARCH.md")) === null) return "research";

  const plan = storage.read(join(taskDir, "PLAN.md"));
  const progress = storage.read(join(taskDir, "PROGRESS.md"));
  if (plan === null || progress === null) return "plan";

  const unchecked = (progress.match(/^- \[ \]/gm) ?? []).length;
  return unchecked === 0 ? "done" : "exec";
}

/**
 * Create state.json for a task directory that existed before state tracking.
 * Infers the phase from which files are present.
 */
export function migrateState(taskDir: string): State {
  const phase = inferPhaseFromFiles(taskDir);
  const name = taskDir.split("/").pop() ?? "unknown";
  const state = buildInitialState({ name, prompt: "", phase });
  writeState(taskDir, state);
  return state;
}

/**
 * Ensure state.json exists in a task directory. Idempotent.
 * If missing, migrates from existing files or initialises fresh.
 */
export function ensureState(taskDir: string): State {
  const filePath = join(taskDir, STATE_FILE);
  const storage = getStorage();
  if (storage.read(filePath) !== null) {
    return readState(taskDir);
  }

  // Check if this is an existing task that predates state tracking
  const hasFiles =
    storage.read(join(taskDir, "RESEARCH.md")) !== null ||
    storage.read(join(taskDir, "PLAN.md")) !== null ||
    storage.read(join(taskDir, "PROGRESS.md")) !== null;

  if (hasFiles) {
    return migrateState(taskDir);
  }

  // Brand-new task — caller should provide proper opts via buildInitialState
  const name = taskDir.split("/").pop() ?? "unknown";
  const state = buildInitialState({ name, prompt: "" });
  writeState(taskDir, state);
  return state;
}
