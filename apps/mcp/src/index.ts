#!/usr/bin/env bun

import { resolve, join } from "node:path";
import { exists } from "node:fs/promises";
import { runWithContext, createDefaultContext } from "@ralphy/context";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools";
import { registerPrompts } from "./prompts";
import { error } from "@ralphy/output";
import { OpenSpecChangeStore } from "@ralphy/openspec";

/**
 * Find the project root by walking up from startDir looking for an openspec/ directory.
 * Falls back to startDir if not found.
 */
async function findProjectRoot(startDir: string): Promise<string> {
  let dir = startDir;
  while (dir !== "/") {
    if (await exists(join(dir, "openspec"))) return dir;
    dir = resolve(dir, "..");
  }
  return startDir;
}

async function main(): Promise<void> {
  // Accept optional --dir argument for project root
  const args = process.argv.slice(2);
  let startDir = process.cwd();
  const dirIdx = args.indexOf("--dir");
  if (dirIdx !== -1 && args[dirIdx + 1]) {
    startDir = resolve(args[dirIdx + 1]!);
  }

  const projectRoot = await findProjectRoot(startDir);
  const changesDir = join(projectRoot, ".ralph", "tasks");
  const taskFilesDir = join(projectRoot, "openspec", "changes");
  const changeStore = new OpenSpecChangeStore();

  const server = new McpServer({
    name: "ralph",
    version: "1.0.0",
  });

  runWithContext(createDefaultContext(), () => {
    registerTools(server, changesDir, changeStore, taskFilesDir);
    registerPrompts(server);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

await main().catch((err) => {
  error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
