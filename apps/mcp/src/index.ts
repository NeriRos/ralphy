#!/usr/bin/env bun

import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { runWithContext, createDefaultContext } from "@ralphy/context";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools";
import { registerPrompts } from "./prompts";
import { error } from "@ralphy/output";
import { OpenSpecChangeStore } from "@ralphy/openspec";

/**
 * Resolve the openspec/changes directory by walking up from a starting dir.
 */
function resolveChangesDir(startDir: string): string {
  let dir = startDir;
  while (dir !== "/") {
    const candidate = join(dir, "openspec", "changes");
    if (existsSync(candidate)) return candidate;
    dir = resolve(dir, "..");
  }
  return join(startDir, "openspec", "changes");
}

async function main(): Promise<void> {
  // Accept optional --dir argument for project root
  const args = process.argv.slice(2);
  let projectDir = process.cwd();
  const dirIdx = args.indexOf("--dir");
  if (dirIdx !== -1 && args[dirIdx + 1]) {
    projectDir = resolve(args[dirIdx + 1]!);
  }

  const changesDir = resolveChangesDir(projectDir);
  const changeStore = new OpenSpecChangeStore();

  const server = new McpServer({
    name: "ralph",
    version: "1.0.0",
  });

  runWithContext(createDefaultContext(), () => {
    registerTools(server, changesDir, changeStore);
    registerPrompts(server);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

await main().catch((err) => {
  error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
