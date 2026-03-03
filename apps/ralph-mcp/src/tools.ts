import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readState, writeState, buildInitialState } from "ralph/state";
import { advancePhase, setPhase } from "ralph/phases";
import { countProgress, extractCurrentSection } from "ralph/progress";
import { commitState } from "ralph/git";
import { resolveTemplatePath } from "ralph/templates";
import type { Phase } from "ralph/types";

const DOCUMENTS = ["RESEARCH.md", "PLAN.md", "PROGRESS.md", "STEERING.md"] as const;

export function registerTools(server: McpServer, tasksDir: string): void {
  // --- ralph_list_tasks ---
  server.tool(
    "ralph_list_tasks",
    "List all ralph tasks with their phase, status, and progress",
    { includeCompleted: z.boolean().optional().describe("Include tasks in 'done' phase") },
    async ({ includeCompleted }) => {
      try {
        if (!existsSync(tasksDir)) {
          return { content: [{ type: "text", text: JSON.stringify({ tasks: [] }) }] };
        }

        const entries = readdirSync(tasksDir, { withFileTypes: true });
        const tasks = [];

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const taskDir = join(tasksDir, entry.name);
          const stateFile = join(taskDir, "state.json");
          if (!existsSync(stateFile)) continue;

          try {
            const state = readState(taskDir);
            if (!includeCompleted && state.phase === "done") continue;

            let progress = null;
            const progressPath = join(taskDir, "PROGRESS.md");
            if (existsSync(progressPath)) {
              progress = countProgress(readFileSync(progressPath, "utf-8"));
            }

            tasks.push({
              name: state.name,
              phase: state.phase,
              status: state.status,
              phaseIteration: state.phaseIteration,
              totalIterations: state.totalIterations,
              progress,
              engine: state.engine,
              model: state.model,
              createdAt: state.createdAt,
              lastModified: state.lastModified,
            });
          } catch {
            // skip tasks with invalid state
          }
        }

        return { content: [{ type: "text", text: JSON.stringify({ tasks }, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error listing tasks: ${err instanceof Error ? err.message : err}` }],
          isError: true,
        };
      }
    },
  );

  // --- ralph_get_task ---
  server.tool(
    "ralph_get_task",
    "Get detailed information about a specific task",
    { name: z.string().describe("Task name") },
    async ({ name }) => {
      try {
        const taskDir = join(tasksDir, name);
        const state = readState(taskDir);

        let progress = null;
        let currentSection = null;
        const progressPath = join(taskDir, "PROGRESS.md");
        if (existsSync(progressPath)) {
          const content = readFileSync(progressPath, "utf-8");
          progress = countProgress(content);
          currentSection = extractCurrentSection(content);
        }

        const documents: string[] = [];
        for (const doc of DOCUMENTS) {
          if (existsSync(join(taskDir, doc))) documents.push(doc);
        }

        let steering = null;
        const steeringPath = join(taskDir, "STEERING.md");
        if (existsSync(steeringPath)) {
          steering = readFileSync(steeringPath, "utf-8");
        }

        const result = {
          name: state.name,
          prompt: state.prompt,
          phase: state.phase,
          status: state.status,
          phaseIteration: state.phaseIteration,
          totalIterations: state.totalIterations,
          engine: state.engine,
          model: state.model,
          createdAt: state.createdAt,
          lastModified: state.lastModified,
          progress,
          currentSection,
          documents,
          steering,
          metadata: state.metadata,
          historyLength: state.history.length,
        };

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error getting task '${name}': ${err instanceof Error ? err.message : err}` }],
          isError: true,
        };
      }
    },
  );

  // --- ralph_read_document ---
  server.tool(
    "ralph_read_document",
    "Read a document file from a task directory",
    {
      name: z.string().describe("Task name"),
      document: z.enum(["RESEARCH.md", "PLAN.md", "PROGRESS.md", "STEERING.md"]).describe("Document to read"),
    },
    async ({ name, document }) => {
      try {
        const filePath = join(tasksDir, name, document);
        if (!existsSync(filePath)) {
          return {
            content: [{ type: "text", text: `Document '${document}' does not exist for task '${name}'` }],
            isError: true,
          };
        }
        const content = readFileSync(filePath, "utf-8");
        return { content: [{ type: "text", text: content }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error reading document: ${err instanceof Error ? err.message : err}` }],
          isError: true,
        };
      }
    },
  );

  // --- ralph_create_task ---
  server.tool(
    "ralph_create_task",
    "Create a new ralph task with initial state and steering file",
    {
      name: z.string().describe("Task name (used as directory name)"),
      prompt: z.string().describe("Task prompt/description"),
      engine: z.string().optional().describe("Engine to use (default: claude)"),
      model: z.string().optional().describe("Model to use (default: opus)"),
    },
    async ({ name, prompt, engine, model }) => {
      try {
        const taskDir = join(tasksDir, name);
        if (existsSync(join(taskDir, "state.json"))) {
          return {
            content: [{ type: "text", text: `Task '${name}' already exists` }],
            isError: true,
          };
        }

        mkdirSync(taskDir, { recursive: true });

        const state = buildInitialState({ name, prompt, engine, model });
        writeState(taskDir, state);

        // Scaffold STEERING.md from template
        const templatePath = resolveTemplatePath("STEERING");
        const steeringPath = join(taskDir, "STEERING.md");
        if (existsSync(templatePath)) {
          copyFileSync(templatePath, steeringPath);
        } else {
          writeFileSync(steeringPath, "# Steering — User Guidance\n\n**Edit this file anytime to steer the task.**\n", "utf-8");
        }

        return {
          content: [{ type: "text", text: JSON.stringify({ created: name, phase: state.phase, taskDir }, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error creating task: ${err instanceof Error ? err.message : err}` }],
          isError: true,
        };
      }
    },
  );

  // --- ralph_run_task ---
  server.tool(
    "ralph_run_task",
    "Start running a task in the background (spawns a detached subprocess)",
    {
      name: z.string().describe("Task name"),
      maxIterations: z.number().optional().describe("Maximum iterations to run"),
      engine: z.string().optional().describe("Engine override"),
      model: z.string().optional().describe("Model override"),
    },
    async ({ name, maxIterations, engine, model }) => {
      try {
        const taskDir = join(tasksDir, name);
        if (!existsSync(join(taskDir, "state.json"))) {
          return {
            content: [{ type: "text", text: `Task '${name}' does not exist` }],
            isError: true,
          };
        }

        const args = ["run", "packages/ralph/src/index.ts", "task", "--name", name];
        if (maxIterations) args.push("--max-iterations", String(maxIterations));
        if (engine) args.push("--engine", engine);
        if (model) args.push("--model", model);

        const child = spawn("bun", args, {
          detached: true,
          stdio: "ignore",
          cwd: join(tasksDir, "..", ".."), // project root
        });
        child.unref();

        return {
          content: [{ type: "text", text: JSON.stringify({ started: name, pid: child.pid }, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error running task: ${err instanceof Error ? err.message : err}` }],
          isError: true,
        };
      }
    },
  );

  // --- ralph_advance_phase ---
  server.tool(
    "ralph_advance_phase",
    "Advance a task to its next phase, or set a specific phase",
    {
      name: z.string().describe("Task name"),
      phase: z.string().optional().describe("Target phase (if omitted, advances to next phase)"),
    },
    async ({ name, phase }) => {
      try {
        const taskDir = join(tasksDir, name);
        const state = readState(taskDir);
        const from = state.phase;

        let updated;
        if (phase) {
          // setPhase writes state internally
          updated = setPhase(state, taskDir, phase as Phase);
        } else {
          // advancePhase does NOT write state — caller must do it
          updated = advancePhase(state, taskDir);
          writeState(taskDir, updated);
        }

        commitState(taskDir, `advance phase: ${from} -> ${updated.phase}`);

        return {
          content: [{ type: "text", text: JSON.stringify({ from, to: updated.phase }, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error advancing phase: ${err instanceof Error ? err.message : err}` }],
          isError: true,
        };
      }
    },
  );

  // --- ralph_update_steering ---
  server.tool(
    "ralph_update_steering",
    "Update the STEERING.md file for a task with new guidance",
    {
      name: z.string().describe("Task name"),
      content: z.string().describe("New STEERING.md content"),
    },
    async ({ name, content }) => {
      try {
        const taskDir = join(tasksDir, name);
        if (!existsSync(taskDir)) {
          return {
            content: [{ type: "text", text: `Task '${name}' does not exist` }],
            isError: true,
          };
        }

        const steeringPath = join(taskDir, "STEERING.md");
        writeFileSync(steeringPath, content, "utf-8");

        return {
          content: [{ type: "text", text: `Updated STEERING.md for task '${name}'` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error updating steering: ${err instanceof Error ? err.message : err}` }],
          isError: true,
        };
      }
    },
  );
}
