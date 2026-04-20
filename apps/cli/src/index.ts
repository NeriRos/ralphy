#!/usr/bin/env bun

if (typeof (globalThis as { Bun?: unknown }).Bun === "undefined") {
  process.stderr.write(
    "ralph requires the Bun runtime (https://bun.sh/). It is not compatible with plain Node.js.\n" +
      "Install Bun and re-run with `bun` or `bunx ralphy`.\n",
  );
  process.exit(1);
}

import { resolve, join, dirname } from "node:path";
import { exists, mkdir } from "node:fs/promises";
import { render } from "ink";
import { createElement } from "react";
import { parseArgs } from "./cli";
import { runWithContext, createDefaultContext } from "@ralphy/context";
import { App } from "./components/App";

/**
 * Find the project root by walking up from cwd looking for an openspec/ directory.
 * Falls back to cwd if not found.
 */
async function findProjectRoot(): Promise<string> {
  let dir = process.cwd();
  while (dir !== "/") {
    if (await exists(join(dir, "openspec"))) return dir;
    dir = resolve(dir, "..");
  }
  return process.cwd();
}

try {
  const args = await parseArgs(process.argv.slice(2));
  const projectRoot = await findProjectRoot();
  const statesDir = join(projectRoot, ".ralph", "tasks");
  const tasksDir = join(projectRoot, "openspec", "changes");

  if (args.mode === "init") {
    await mkdir(statesDir, { recursive: true });
    const openspecBin = join(
      dirname(Bun.resolveSync("@fission-ai/openspec/package.json", import.meta.dir)),
      "bin",
      "openspec.js",
    );
    Bun.spawnSync({
      cmd: [process.execPath, openspecBin, "init", "--tools", "none", "--force"],
      stdio: ["inherit", "inherit", "inherit"],
      cwd: process.cwd(),
    });
  }

  if (args.mode === "task" && args.name) {
    await mkdir(join(statesDir, args.name), { recursive: true });
    await mkdir(join(tasksDir, args.name), { recursive: true });
  }

  runWithContext(createDefaultContext(), () => {
    render(createElement(App, { args, statesDir, tasksDir }));
  });
} catch (err) {
  process.stderr.write((err instanceof Error ? err.message : String(err)) + "\n");
  process.exit(1);
}
