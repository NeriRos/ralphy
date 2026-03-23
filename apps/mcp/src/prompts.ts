import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Extracted schemas to avoid TS2589 (excessively deep type instantiation)
const createArgs = {
  name: z.string().describe("Task name"),
  prompt: z.string().describe("Task description"),
};

const nameArg = {
  name: z.string().describe("Task name"),
};

const steerArgs = {
  name: z.string().describe("Task name"),
  guidance: z.string().describe("Steering guidance to add"),
};

export function registerPrompts(server: McpServer): void {
  // --- /ralph-create ---
  server.registerPrompt(
    "ralph-create",
    {
      title: "Create Ralph Task",
      description: "Create a new ralph task",
      argsSchema: createArgs,
    },
    async ({ name, prompt }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Create a new ralph task named "${name}" with the following prompt:\n\n${prompt}`,
          },
        },
      ],
    }),
  );

  // --- /ralph-list ---
  server.registerPrompt(
    "ralph-list",
    {
      title: "List Ralph Tasks",
      description: "List all active ralph tasks with status",
    },
    async () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: "List all ralph tasks and show their current phase, status, and progress.",
          },
        },
      ],
    }),
  );

  // --- /ralph-status ---
  server.registerPrompt(
    "ralph-status",
    {
      title: "Ralph Task Status",
      description: "Get detailed status of a specific task",
      argsSchema: nameArg,
    },
    async ({ name }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Get the detailed status of ralph task "${name}", including its phase, progress, and any steering guidance.`,
          },
        },
      ],
    }),
  );

  // --- /ralph-run ---
  server.registerPrompt(
    "ralph-run",
    {
      title: "Run Ralph Task",
      description: "Run a ralph task in the background",
      argsSchema: nameArg,
    },
    async ({ name }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Run ralph task "${name}" in the background.`,
          },
        },
      ],
    }),
  );

  // --- /ralph-advance ---
  server.registerPrompt(
    "ralph-advance",
    {
      title: "Advance Ralph Task",
      description: "Advance a ralph task to its next phase",
      argsSchema: nameArg,
    },
    async ({ name }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Advance ralph task "${name}" to its next phase.`,
          },
        },
      ],
    }),
  );

  // --- /ralph-steer ---
  server.registerPrompt(
    "ralph-steer",
    {
      title: "Steer Ralph Task",
      description: "Update STEERING.md with new guidance for a task",
      argsSchema: steerArgs,
    },
    async ({ name, guidance }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Update the STEERING.md for ralph task "${name}" with the following guidance:\n\n${guidance}`,
          },
        },
      ],
    }),
  );
}
