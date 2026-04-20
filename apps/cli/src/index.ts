#!/usr/bin/env bun

import { resolve, join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { render } from "ink";
import { createElement } from "react";
import { parseArgs } from "./cli";
import { runWithContext, createDefaultContext } from "@ralphy/context";
import { App } from "./components/App";

/**
 * Resolve the openspec/changes directory by walking up from cwd.
 * Falls back to <cwd>/openspec/changes if not found.
 */
function resolveChangesDir(): string {
  let dir = process.cwd();
  while (dir !== "/") {
    const candidate = join(dir, "openspec", "changes");
    if (existsSync(candidate)) return candidate;
    dir = resolve(dir, "..");
  }
  return join(process.cwd(), "openspec", "changes");
}

try {
  const args = parseArgs(process.argv.slice(2));
  const changesDir = resolveChangesDir();

  if (args.mode === "init") {
    mkdirSync(changesDir, { recursive: true });
  }

  runWithContext(createDefaultContext(), () => {
    render(createElement(App, { args, changesDir }));
  });
} catch (err) {
  process.stderr.write((err instanceof Error ? err.message : String(err)) + "\n");
  process.exit(1);
}
