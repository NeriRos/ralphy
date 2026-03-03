#!/usr/bin/env bun

import { resolve, join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { parseArgs } from "./cli";
import { showList, showStatus } from "./display";
import { readState, ensureState, writeState } from "./state";
import { advancePhase, setPhase } from "./phases";
import { commitState } from "./git";
import { mainLoop } from "./loop";
import type { Phase } from "./types";

/**
 * Resolve the .ralph/tasks directory by walking up from cwd.
 */
function resolveTasksDir(): string {
  let dir = process.cwd();
  while (dir !== "/") {
    const candidate = join(dir, ".ralph", "tasks");
    if (existsSync(candidate)) return candidate;
    dir = resolve(dir, "..");
  }
  return join(process.cwd(), ".ralph", "tasks");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const tasksDir = resolveTasksDir();

  switch (args.mode) {
    case "list": {
      showList(tasksDir);
      break;
    }

    case "status": {
      if (!args.name) {
        console.error("Error: --name is required for status mode");
        process.exit(1);
      }
      const taskDir = join(tasksDir, args.name);
      if (!existsSync(join(taskDir, "state.json"))) {
        console.error(`Error: task '${args.name}' not found`);
        process.exit(1);
      }
      const state = readState(taskDir);
      showStatus(state, taskDir);
      break;
    }

    case "advance": {
      if (!args.name) {
        console.error("Error: --name is required for advance mode");
        process.exit(1);
      }
      const taskDir = join(tasksDir, args.name);
      const state = ensureState(taskDir);
      const updated = advancePhase(state, taskDir);
      writeState(taskDir, updated);
      commitState(taskDir, `advance phase: ${state.phase} -> ${updated.phase}`);
      console.log(`Advanced: ${state.phase} -> ${updated.phase}`);
      break;
    }

    case "set-phase": {
      if (!args.name) {
        console.error("Error: --name is required for set-phase mode");
        process.exit(1);
      }
      if (!args.phase) {
        console.error("Error: --phase is required for set-phase mode");
        process.exit(1);
      }
      const taskDir = join(tasksDir, args.name);
      const state = ensureState(taskDir);
      const updated = setPhase(state, taskDir, args.phase as Phase);
      console.log(`Set phase: ${state.phase} -> ${updated.phase}`);
      break;
    }

    case "task": {
      if (!args.name) {
        console.error("Error: --name is required for task mode");
        process.exit(1);
      }

      mkdirSync(join(tasksDir, args.name), { recursive: true });

      await mainLoop({
        name: args.name,
        prompt: args.prompt,
        engine: args.engine,
        model: args.model,
        maxIterations: args.maxIterations,
        noExecute: args.noExecute,
        delay: args.delay,
        log: args.log,
        tasksDir,
      });
      break;
    }
  }
}

await main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
