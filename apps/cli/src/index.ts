#!/usr/bin/env bun

import { resolve, join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { render } from "ink";
import { createElement } from "react";
import { parseArgs } from "./cli";
import { runWithContext, createDefaultContext } from "@ralphy/context";
import { App } from "./components/App";

/**
 * Find the project root by walking up from cwd looking for an openspec/ directory.
 * Falls back to cwd if not found.
 */
function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== "/") {
    if (existsSync(join(dir, "openspec"))) return dir;
    dir = resolve(dir, "..");
  }
  return process.cwd();
}

try {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = findProjectRoot();
  const statesDir = join(projectRoot, ".ralph", "tasks");
  const tasksDir = join(projectRoot, "openspec", "changes");

  if (args.mode === "init") {
    mkdirSync(statesDir, { recursive: true });
    spawnSync("bunx", ["openspec", "init", "--tools", "none", "--force"], {
      stdio: "inherit",
      cwd: process.cwd(),
    });
  }

  runWithContext(createDefaultContext(), () => {
    render(createElement(App, { args, statesDir, tasksDir }));
  });
} catch (err) {
  process.stderr.write((err instanceof Error ? err.message : String(err)) + "\n");
  process.exit(1);
}
