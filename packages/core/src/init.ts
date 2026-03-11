import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

const GITIGNORE_CONTENT = `tasks/
`;

/**
 * Initialize the .ralph directory structure.
 * Creates .ralph/tasks/ and .ralph/.gitignore.
 * Safe to call multiple times — only creates what's missing.
 */
export function initRalph(ralphDir: string): void {
  mkdirSync(join(ralphDir, "tasks"), { recursive: true });

  const gitignorePath = join(ralphDir, ".gitignore");
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, GITIGNORE_CONTENT);
  }
}

/**
 * Initialize .ralph from a tasks directory path.
 * The ralphDir is derived as the parent of tasksDir.
 */
export function initRalphFromTasksDir(tasksDir: string): void {
  initRalph(dirname(tasksDir));
}
