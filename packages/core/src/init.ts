import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

/**
 * Initialize the .ralph directory structure.
 * Creates .ralph/tasks/.
 * Safe to call multiple times — only creates what's missing.
 */
export async function initRalph(ralphDir: string): Promise<void> {
  await mkdir(join(ralphDir, "tasks"), { recursive: true });
}

/**
 * Initialize .ralph from a tasks directory path.
 * The ralphDir is derived as the parent of tasksDir.
 */
export async function initRalphFromTasksDir(tasksDir: string): Promise<void> {
  await initRalph(dirname(tasksDir));
}
