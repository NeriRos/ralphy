import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");

/** Absolute path to the scaffolds directory (document templates with {{PLACEHOLDER}} vars). */
export function resolveScaffoldsDir(): string {
  return resolve(packageRoot, "scaffolds");
}

/** Absolute path to the tasks directory (files copied to every .tasks/ dir). */
export function resolveTasksDir(): string {
  return resolve(packageRoot, "tasks");
}

/** Absolute path to the phases directory (phase .md files with frontmatter). */
export function resolvePhasesDir(): string {
  return resolve(packageRoot, "phases");
}

/** Absolute path to the checklists directory (verification checklist .md files). */
export function resolveChecklistsDir(): string {
  return resolve(packageRoot, "checklists");
}
