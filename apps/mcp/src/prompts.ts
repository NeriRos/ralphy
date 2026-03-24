import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

function textPrompt(text: string): GetPromptResult {
  return {
    messages: [{ role: "user", content: { type: "text", text } }],
  };
}

// Wrapper to avoid TS2589: registerPrompt/prompt with Zod schemas triggers
// excessively deep type instantiation in the MCP SDK's generic inference.
function registerPrompt(
  server: McpServer,
  name: string,
  description: string,
  argsSchema: Record<string, z.ZodType>,
  cb: (args: Record<string, string>) => Promise<GetPromptResult>,
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server as any).prompt(name, description, argsSchema, cb);
}

export function registerPrompts(server: McpServer): void {
  registerPrompt(
    server,
    "ralph-create",
    "Create a new ralph task",
    { name: z.string().describe("Task name"), prompt: z.string().describe("Task description") },
    async (args) =>
      textPrompt(
        `Create a new ralph task named "${args.name}" with the following prompt:\n\n${args.prompt}`,
      ),
  );

  server.prompt("ralph-list", "List all active ralph tasks with status", async () =>
    textPrompt("List all ralph tasks and show their current phase, status, and progress."),
  );

  registerPrompt(
    server,
    "ralph-status",
    "Get detailed status of a specific task",
    { name: z.string().describe("Task name") },
    async (args) =>
      textPrompt(
        `Get the detailed status of ralph task "${args.name}", including its phase, progress, and any steering guidance.`,
      ),
  );

  registerPrompt(
    server,
    "ralph-run",
    "Run a ralph task in the background",
    { name: z.string().describe("Task name") },
    async (args) => textPrompt(`Run ralph task "${args.name}" in the background.`),
  );

  registerPrompt(
    server,
    "ralph-advance",
    "Advance a ralph task to its next phase",
    { name: z.string().describe("Task name") },
    async (args) => textPrompt(`Advance ralph task "${args.name}" to its next phase.`),
  );

  registerPrompt(
    server,
    "ralph-steer",
    "Update STEERING.md with new guidance for a task",
    {
      name: z.string().describe("Task name"),
      guidance: z.string().describe("Steering guidance to add"),
    },
    async (args) =>
      textPrompt(
        `Update the STEERING.md for ralph task "${args.name}" with the following guidance:\n\n${args.guidance}`,
      ),
  );
}
