import { join } from "node:path";
import { rmSync } from "node:fs";
import { getStorage } from "@ralphy/context";
import { readState, buildInitialState, writeState, ensureState } from "@ralphy/core/state";
import { countProgress } from "@ralphy/core/progress";
import { advancePhase, setPhase } from "@ralphy/core/phases";
import { scaffoldTaskDocuments } from "@ralphy/core/templates";
import { isTaskRunning } from "./loop";
import type { SidecarContext } from "../types";

interface RouteResult {
  status: number;
  body: unknown;
}

export async function taskRoutes(
  req: Request,
  route: { action: string; name: string | undefined },
  ctx: SidecarContext,
): Promise<RouteResult> {
  const storage = getStorage();

  switch (route.action) {
    case "list": {
      // POST /tasks → create; GET /tasks → list
      if (req.method === "POST") {
        const body = (await req.json()) as {
          name: string;
          prompt: string;
          engine?: string;
          model?: string;
        };
        if (!body.name || !body.prompt) {
          return { status: 400, body: { error: "name and prompt are required" } };
        }

        const taskDir = join(ctx.tasksDir, body.name);
        const state = buildInitialState({
          name: body.name,
          prompt: body.prompt,
          engine: (body.engine ?? "claude") as "claude" | "codex",
          model: body.model ?? "sonnet",
        });
        writeState(taskDir, state);
        scaffoldTaskDocuments(taskDir);

        return { status: 201, body: state };
      }

      const entries = storage.list(ctx.tasksDir);
      const tasks = [];
      for (const name of entries) {
        if (name.startsWith(".")) continue;
        const taskDir = join(ctx.tasksDir, name);
        try {
          const state = ensureState(taskDir);
          const progressContent = storage.read(join(taskDir, "PROGRESS.md"));
          const progress = progressContent !== null ? countProgress(progressContent) : null;
          tasks.push({ ...state, progress, isRunning: isTaskRunning(name) });
        } catch {
          // Skip invalid tasks
        }
      }
      return { status: 200, body: tasks };
    }

    case "get": {
      if (!route.name) return { status: 400, body: { error: "Missing task name" } };
      const taskDir = join(ctx.tasksDir, route.name);
      try {
        const state = ensureState(taskDir);
        const progressContent = storage.read(join(taskDir, "PROGRESS.md"));
        const progress = progressContent !== null ? countProgress(progressContent) : null;
        return { status: 200, body: { ...state, progress, isRunning: isTaskRunning(route.name) } };
      } catch {
        return { status: 404, body: { error: "Task not found" } };
      }
    }

    case "advance": {
      if (req.method !== "POST") return { status: 405, body: { error: "Method not allowed" } };
      if (!route.name) return { status: 400, body: { error: "Missing task name" } };
      const taskDir = join(ctx.tasksDir, route.name);
      try {
        const state = readState(taskDir);
        const newState = advancePhase(state, taskDir);
        return { status: 200, body: newState };
      } catch {
        return { status: 404, body: { error: "Task not found" } };
      }
    }

    case "delete": {
      if (req.method !== "DELETE") return { status: 405, body: { error: "Method not allowed" } };
      if (!route.name) return { status: 400, body: { error: "Missing task name" } };
      const taskDir = join(ctx.tasksDir, route.name);
      try {
        rmSync(taskDir, { recursive: true, force: true });
        return { status: 200, body: { deleted: true } };
      } catch {
        return { status: 500, body: { error: "Failed to delete task" } };
      }
    }

    case "set-phase": {
      if (req.method !== "POST") return { status: 405, body: { error: "Method not allowed" } };
      if (!route.name) return { status: 400, body: { error: "Missing task name" } };
      const body = (await req.json()) as { phase: string };
      if (!body.phase) return { status: 400, body: { error: "phase is required" } };
      const taskDir = join(ctx.tasksDir, route.name);
      try {
        const state = readState(taskDir);
        const newState = setPhase(state, taskDir, body.phase);
        return { status: 200, body: newState };
      } catch {
        return { status: 404, body: { error: "Task not found" } };
      }
    }

    default:
      return { status: 404, body: { error: "Unknown action" } };
  }
}
