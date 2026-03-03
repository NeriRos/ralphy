import { execSync } from "node:child_process";
import { join } from "node:path";

/**
 * Get the current git branch name.
 */
export function getCurrentBranch(): string {
  try {
    return execSync("git branch --show-current", { encoding: "utf-8" }).trim();
  } catch {
    return "main";
  }
}

/**
 * Stage files for commit.
 */
export function gitAdd(files: string[]): void {
  execSync(`git add ${files.map((f) => `"${f}"`).join(" ")}`, {
    stdio: "pipe",
  });
}

/**
 * Create a git commit with the given message.
 */
export function gitCommit(message: string): void {
  execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
    stdio: "pipe",
  });
}

/**
 * Push to remote with fallback chain:
 * 1. git push
 * 2. git push -u origin <branch>
 * 3. git push --set-upstream origin <branch>
 * If all fail, silently skip (no remote configured).
 */
export function gitPush(): void {
  const branch = getCurrentBranch();
  try {
    execSync("git push", { stdio: "pipe" });
  } catch {
    try {
      execSync(`git push -u origin ${branch}`, { stdio: "pipe" });
    } catch {
      try {
        execSync(`git push --set-upstream origin ${branch}`, { stdio: "pipe" });
      } catch {
        // No remote configured — skip push
      }
    }
  }
}

/**
 * Commit the state.json file in a task directory with the given message.
 */
export function commitState(taskDir: string, message: string): void {
  const stateFile = join(taskDir, "state.json");
  try {
    gitAdd([stateFile]);
    gitCommit(message);
  } catch {
    // state file may not exist or nothing to commit
  }
}
