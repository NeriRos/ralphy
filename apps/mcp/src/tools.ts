import { join } from "node:path";
import { spawn } from "node:child_process";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readState, writeState, buildInitialState } from "@ralphy/core/state";
import { advancePhase, setPhase } from "@ralphy/core/phases";
import { countProgress, extractCurrentSection } from "@ralphy/core/progress";
import { commitState } from "@ralphy/core/git";
import { resolveTemplatePath, resolveChecklistDir, listChecklists } from "@ralphy/core/templates";
import { getStorage, runWithContext, createDefaultContext } from "@ralphy/context";
import { getPhase } from "@ralphy/phases";

const DOCUMENTS = ["RESEARCH.md", "PLAN.md", "PROGRESS.md", "STEERING.md"] as const;

export function registerTools(server: McpServer, tasksDir: string): void {
  // --- ralph_list_tasks ---
  server.registerTool(
    "ralph_list_tasks",
    {
      description: "List all ralph tasks with their phase, status, and progress",
      inputSchema: {
        includeCompleted: z.boolean().optional().describe("Include tasks in 'done' phase"),
      },
    },
    async ({ includeCompleted }) => {
      return runWithContext(createDefaultContext(), () => {
        try {
          const storage = getStorage();
          const entries = storage.list(tasksDir);
          const tasks = [];

          for (const entry of entries) {
            const taskDir = join(tasksDir, entry);

            try {
              const state = readState(taskDir);
              try {
                const phaseConfig = getPhase(state.phase);
                if (!includeCompleted && phaseConfig.terminal) continue;
              } catch {
                // Unknown phase — include it
              }

              let progress = null;
              const progressContent = storage.read(join(taskDir, "PROGRESS.md"));
              if (progressContent !== null) {
                progress = countProgress(progressContent);
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

          return { content: [{ type: "text" as const, text: JSON.stringify({ tasks }, null, 2) }] };
        } catch (err) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error listing tasks: ${err instanceof Error ? err.message : err}`,
              },
            ],
            isError: true,
          };
        }
      });
    },
  );

  // --- ralph_get_task ---
  server.registerTool(
    "ralph_get_task",
    {
      description: "Get detailed information about a specific task",
      inputSchema: { name: z.string().describe("Task name") },
    },
    async ({ name }) => {
      return runWithContext(createDefaultContext(), () => {
        try {
          const storage = getStorage();
          const taskDir = join(tasksDir, name);
          const state = readState(taskDir);

          let progress = null;
          let currentSection = null;
          const progressContent = storage.read(join(taskDir, "PROGRESS.md"));
          if (progressContent !== null) {
            progress = countProgress(progressContent);
            currentSection = extractCurrentSection(progressContent);
          }

          const documents: string[] = [];
          for (const doc of DOCUMENTS) {
            if (storage.read(join(taskDir, doc)) !== null) documents.push(doc);
          }

          const steering = storage.read(join(taskDir, "STEERING.md"));

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

          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error getting task '${name}': ${err instanceof Error ? err.message : err}`,
              },
            ],
            isError: true,
          };
        }
      });
    },
  );

  // --- ralph_read_document ---
  server.registerTool(
    "ralph_read_document",
    {
      description: "Read a document file from a task directory",
      inputSchema: {
        name: z.string().describe("Task name"),
        document: z
          .enum(["RESEARCH.md", "PLAN.md", "PROGRESS.md", "STEERING.md"])
          .describe("Document to read"),
      },
    },
    async ({ name, document }) => {
      return runWithContext(createDefaultContext(), () => {
        try {
          const content = getStorage().read(join(tasksDir, name, document));
          if (content === null) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Document '${document}' does not exist for task '${name}'`,
                },
              ],
              isError: true,
            };
          }
          return { content: [{ type: "text" as const, text: content }] };
        } catch (err) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error reading document: ${err instanceof Error ? err.message : err}`,
              },
            ],
            isError: true,
          };
        }
      });
    },
  );

  // --- ralph_create_task ---
  server.registerTool(
    "ralph_create_task",
    {
      description: "Create a new ralph task with initial state and steering file",
      inputSchema: {
        name: z.string().describe("Task name (used as directory name)"),
        prompt: z.string().describe("Task prompt/description"),
        engine: z.string().optional().describe("Engine to use (default: claude)"),
        model: z.string().optional().describe("Model to use (default: opus)"),
      },
    },
    async ({ name, prompt, engine, model }) => {
      return runWithContext(createDefaultContext(), () => {
        try {
          const storage = getStorage();
          const taskDir = join(tasksDir, name);
          if (storage.read(join(taskDir, "state.json")) !== null) {
            return {
              content: [{ type: "text" as const, text: `Task '${name}' already exists` }],
              isError: true,
            };
          }

          const state = buildInitialState({
            name,
            prompt,
            ...(engine !== undefined && { engine }),
            ...(model !== undefined && { model }),
          });
          writeState(taskDir, state);

          // Scaffold STEERING.md from template
          const steeringPath = join(taskDir, "STEERING.md");
          const tmpl = storage.read(resolveTemplatePath("STEERING"));
          if (tmpl !== null) {
            storage.write(steeringPath, tmpl);
          } else {
            storage.write(
              steeringPath,
              "# Steering — User Guidance\n\n**Edit this file anytime to steer the task.**\n",
            );
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ created: name, phase: state.phase, taskDir }, null, 2),
              },
            ],
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error creating task: ${err instanceof Error ? err.message : err}`,
              },
            ],
            isError: true,
          };
        }
      });
    },
  );

  // --- ralph_run_task ---
  server.registerTool(
    "ralph_run_task",
    {
      description: "Start running a task in the background (spawns a detached subprocess)",
      inputSchema: {
        name: z.string().describe("Task name"),
        maxIterations: z.number().optional().describe("Maximum iterations to run"),
        engine: z.string().optional().describe("Engine override"),
        model: z.string().optional().describe("Model override"),
      },
    },
    async ({ name, maxIterations, engine, model }) => {
      return runWithContext(createDefaultContext(), () => {
        try {
          const taskDir = join(tasksDir, name);
          if (getStorage().read(join(taskDir, "state.json")) === null) {
            return {
              content: [{ type: "text" as const, text: `Task '${name}' does not exist` }],
              isError: true,
            };
          }

          const args = ["run", "apps/cli/src/index.ts", "task", "--name", name];
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
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ started: name, pid: child.pid }, null, 2),
              },
            ],
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error running task: ${err instanceof Error ? err.message : err}`,
              },
            ],
            isError: true,
          };
        }
      });
    },
  );

  // --- ralph_advance_phase ---
  server.registerTool(
    "ralph_advance_phase",
    {
      description: "Advance a task to its next phase, or set a specific phase",
      inputSchema: {
        name: z.string().describe("Task name"),
        phase: z.string().optional().describe("Target phase (if omitted, advances to next phase)"),
      },
    },
    async ({ name, phase }) => {
      return runWithContext(createDefaultContext(), () => {
        try {
          const taskDir = join(tasksDir, name);
          const state = readState(taskDir);
          const from = state.phase;

          let updated;
          if (phase) {
            // setPhase writes state internally
            updated = setPhase(state, taskDir, phase);
          } else {
            // advancePhase does NOT write state — caller must do it
            updated = advancePhase(state, taskDir);
            writeState(taskDir, updated);
          }

          commitState(taskDir, `advance phase: ${from} -> ${updated.phase}`);

          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ from, to: updated.phase }, null, 2) },
            ],
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error advancing phase: ${err instanceof Error ? err.message : err}`,
              },
            ],
            isError: true,
          };
        }
      });
    },
  );

  // --- ralph_update_steering ---
  server.registerTool(
    "ralph_update_steering",
    {
      description: "Update the STEERING.md file for a task with new guidance",
      inputSchema: {
        name: z.string().describe("Task name"),
        content: z.string().describe("New STEERING.md content"),
      },
    },
    async ({ name, content }) => {
      return runWithContext(createDefaultContext(), () => {
        try {
          const storage = getStorage();
          const taskDir = join(tasksDir, name);
          // Verify task exists by checking for state
          if (storage.read(join(taskDir, "state.json")) === null) {
            return {
              content: [{ type: "text" as const, text: `Task '${name}' does not exist` }],
              isError: true,
            };
          }

          storage.write(join(taskDir, "STEERING.md"), content);

          return {
            content: [{ type: "text" as const, text: `Updated STEERING.md for task '${name}'` }],
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error updating steering: ${err instanceof Error ? err.message : err}`,
              },
            ],
            isError: true,
          };
        }
      });
    },
  );

  // --- ralph_list_checklists ---
  server.registerTool(
    "ralph_list_checklists",
    {
      description: "List available verification checklists with their contents",
      inputSchema: {},
    },
    async () => {
      return runWithContext(createDefaultContext(), () => {
        try {
          const storage = getStorage();
          const dir = resolveChecklistDir();
          const names = listChecklists();
          const checklists = names.map((name) => ({
            name,
            content: storage.read(join(dir, `${name}.md`)) ?? "",
          }));
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ checklists }, null, 2) }],
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error listing checklists: ${err instanceof Error ? err.message : err}`,
              },
            ],
            isError: true,
          };
        }
      });
    },
  );

  // --- ralph_apply_checklist ---
  server.registerTool(
    "ralph_apply_checklist",
    {
      description:
        "Append verification checklists as new sections at the end of a task's PROGRESS.md",
      inputSchema: {
        name: z.string().describe("Task name"),
        checklists: z
          .array(z.string())
          .describe('Checklist names to append (e.g. ["checklist_static", "checklist_tests"])'),
      },
    },
    async ({ name, checklists }) => {
      return runWithContext(createDefaultContext(), () => {
        try {
          const storage = getStorage();
          const taskDir = join(tasksDir, name);
          if (storage.read(join(taskDir, "state.json")) === null) {
            return {
              content: [{ type: "text" as const, text: `Task '${name}' does not exist` }],
              isError: true,
            };
          }

          const progressPath = join(taskDir, "PROGRESS.md");
          let progress = storage.read(progressPath);
          if (progress === null) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `PROGRESS.md does not exist for task '${name}'`,
                },
              ],
              isError: true,
            };
          }

          // Count existing sections to auto-number
          const sectionMatches = progress.match(/^## Section \d+/gm);
          let nextSection = (sectionMatches?.length ?? 0) + 1;

          const dir = resolveChecklistDir();
          const applied: string[] = [];

          for (const cl of checklists) {
            const raw = storage.read(join(dir, `${cl}.md`));
            if (raw === null) continue;

            const { title, body } = parseChecklist(raw);
            progress += `\n## Section ${nextSection} — ${title}\n\n${body.trimEnd()}\n`;
            nextSection++;
            applied.push(cl);
          }

          storage.write(progressPath, progress);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ applied, totalSections: nextSection - 1 }, null, 2),
              },
            ],
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error applying checklists: ${err instanceof Error ? err.message : err}`,
              },
            ],
            isError: true,
          };
        }
      });
    },
  );
}

/**
 * Parse a checklist file: extract the H1 title and the remaining body.
 * If no H1 is found, falls back to "Checklist".
 */
function parseChecklist(content: string): { title: string; body: string } {
  const match = content.match(/^# (.+)\n/);
  if (match) {
    return { title: match[1]!, body: content.slice(match[0].length).replace(/^\n+/, "") };
  }
  return { title: "Checklist", body: content };
}
