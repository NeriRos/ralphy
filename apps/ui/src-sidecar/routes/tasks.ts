import { join } from "node:path";
import { rm } from "node:fs/promises";
import { getStorage } from "@ralphy/context";
import { buildInitialState, writeState, ensureState } from "@ralphy/core/state";
import { isTaskRunning } from "./loop";
import type { State } from "@ralphy/types";
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

        const changeDir = join(ctx.tasksDir, body.name);
        const state = buildInitialState({
          name: body.name,
          prompt: body.prompt,
          engine: (body.engine ?? "claude") as "claude" | "codex",
          model: body.model ?? "sonnet",
        });
        writeState(changeDir, state);

        return { status: 201, body: state };
      }

      const entries = storage.list(ctx.tasksDir);
      const changes: Array<State & { isRunning: boolean }> = [];
      for (const name of entries) {
        if (name.startsWith(".")) continue;
        const changeDir = join(ctx.tasksDir, name);
        try {
          const state = ensureState(changeDir);
          changes.push({ ...state, isRunning: isTaskRunning(name) });
        } catch {
          // Skip invalid changes
        }
      }
      return { status: 200, body: changes };
    }

    case "get": {
      if (!route.name) return { status: 400, body: { error: "Missing change name" } };
      const changeDir = join(ctx.tasksDir, route.name);
      try {
        const state = ensureState(changeDir);
        return { status: 200, body: { ...state, isRunning: isTaskRunning(route.name) } };
      } catch {
        return { status: 404, body: { error: "Change not found" } };
      }
    }

    case "delete": {
      if (req.method !== "DELETE") return { status: 405, body: { error: "Method not allowed" } };
      if (!route.name) return { status: 400, body: { error: "Missing change name" } };
      const changeDir = join(ctx.tasksDir, route.name);
      try {
        await rm(changeDir, { recursive: true, force: true });
        return { status: 200, body: { deleted: true } };
      } catch {
        return { status: 500, body: { error: "Failed to delete change" } };
      }
    }

    default:
      return { status: 404, body: { error: "Unknown action" } };
  }
}
