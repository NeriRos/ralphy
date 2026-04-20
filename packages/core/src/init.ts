import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

/**
 * Initialize the .ralph directory structure.
 * Creates .ralph/tasks/.
 * Safe to call multiple times — only creates what's missing.
 */
export function initRalph(ralphDir: string): void {
  mkdirSync(join(ralphDir, "tasks"), { recursive: true });
}

/**
 * Initialize .ralph from a tasks directory path.
 * The ralphDir is derived as the parent of tasksDir.
 */
export function initRalphFromTasksDir(tasksDir: string): void {
  initRalph(dirname(tasksDir));
}
