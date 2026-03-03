#!/usr/bin/env bun

import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools";

/**
 * Resolve the .ralph/tasks directory by walking up from a starting dir.
 */
function resolveTasksDir(startDir: string): string {
  let dir = startDir;
  while (dir !== "/") {
    const candidate = join(dir, ".ralph", "tasks");
    if (existsSync(candidate)) return candidate;
    dir = resolve(dir, "..");
  }
  return join(startDir, ".ralph", "tasks");
}

async function main(): Promise<void> {
  // Accept optional --dir argument for project root
  const args = process.argv.slice(2);
  let projectDir = process.cwd();
  const dirIdx = args.indexOf("--dir");
  if (dirIdx !== -1 && args[dirIdx + 1]) {
    projectDir = resolve(args[dirIdx + 1]!);
  }

  const tasksDir = resolveTasksDir(projectDir);

  const server = new McpServer({
    name: "ralph",
    version: "1.0.0",
  });

  registerTools(server, tasksDir);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

await main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
