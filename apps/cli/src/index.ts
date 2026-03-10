#!/usr/bin/env bun

import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { render } from "ink";
import { createElement } from "react";
import { parseArgs } from "./cli";
import { runWithContext, createDefaultContext } from "@ralphy/context";
import { scaffoldTasksDir } from "@ralphy/core/templates";
import { App } from "./components/App";

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

try {
  const args = parseArgs(process.argv.slice(2));
  const tasksDir = resolveTasksDir();

  runWithContext(createDefaultContext(), () => {
    scaffoldTasksDir(tasksDir);
    render(createElement(App, { args, tasksDir }));
  });
} catch (err) {
  process.stderr.write((err instanceof Error ? err.message : String(err)) + "\n");
  process.exit(1);
}
