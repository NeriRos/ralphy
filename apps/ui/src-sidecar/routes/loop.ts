import { join } from "node:path";
import { runWithContext, createDefaultContext, getStorage } from "@ralphy/context";
import { readState, writeState, buildInitialState } from "@ralphy/core/state";
import { countProgress, parseProgressItems } from "@ralphy/core/progress";
import { scaffoldTaskDocuments } from "@ralphy/core/templates";
import { runEngine, handleEngineFailure } from "@ralphy/engine/engine";
import { autoTransitionAfterIteration } from "@ralphy/core/phases";
import { gitPush, commitTaskDir } from "@ralphy/core/git";
import {
  buildTaskPrompt,
  checkStopCondition,
  updateStateIteration,
  checkStopSignal,
  appendSteeringMessage,
  buildSteeringPrompt,
  mergeUsage,
  type LoopOptions,
} from "../loop-utils";
import { getActiveStreams } from "../streams";
import type { SidecarContext } from "../types";
import type { FeedEvent, State } from "@ralphy/types";

// Track running loops so we can stop them
const runningLoops = new Map<string, { cancel: () => void }>();

// Track the current engine AbortController per task so steering can kill it
const engineAbortControllers = new Map<string, AbortController>();

// Track pending steering messages per task (set by steer endpoint, consumed by loop)
const pendingSteerMessages = new Map<string, string>();

interface RouteResult {
  status: number;
  body: unknown;
}

function broadcast(taskName: string, message: Record<string, unknown>) {
  const streams = getActiveStreams().get(taskName);
  if (!streams) return;
  const json = JSON.stringify(message);
  for (const ws of streams) {
    try {
      ws.send(json);
    } catch {
      // Client disconnected
    }
  }
}

export async function loopRoutes(
  req: Request,
  route: { name: string; action: string },
  ctx: SidecarContext,
): Promise<RouteResult> {
  if (req.method !== "POST") {
    return { status: 405, body: { error: "Method not allowed" } };
  }

  const taskName = route.name;
  const taskDir = join(ctx.tasksDir, taskName);

  if (route.action === "stop") {
    const running = runningLoops.get(taskName);
    if (running) {
      running.cancel();
      runningLoops.delete(taskName);
    }
    // Also write a STOP signal file
    const storage = getStorage();
    storage.write(join(taskDir, "STOP"), "Stopped via UI");
    return { status: 200, body: { stopped: true } };
  }

  if (route.action === "steer") {
    const body = (await req.json()) as { message: string };
    // Append to STEERING.md using shared helper
    await runWithContext(createDefaultContext(), async () => {
      appendSteeringMessage(taskDir, body.message);
    });
    // Store pending message and kill the current engine so the loop can resume with it
    pendingSteerMessages.set(taskName, body.message);
    const ac = engineAbortControllers.get(taskName);
    if (ac) {
      ac.abort();
    }
    return { status: 200, body: { steered: true } };
  }

  if (route.action === "start") {
    if (runningLoops.has(taskName)) {
      return { status: 409, body: { error: "Task is already running" } };
    }

    const body = (await req.json()) as Partial<LoopOptions>;

    const opts: LoopOptions = {
      name: taskName,
      prompt: body.prompt ?? "",
      engine: body.engine ?? "claude",
      model: body.model ?? "sonnet",
      maxIterations: body.maxIterations ?? 0,
      maxCostUsd: body.maxCostUsd ?? 0,
      maxRuntimeMinutes: body.maxRuntimeMinutes ?? 0,
      maxConsecutiveFailures: body.maxConsecutiveFailures ?? 5,
      noExecute: body.noExecute ?? false,
      interactive: false, // Not supported in UI
      delay: body.delay ?? 2,
      log: body.log ?? false,
      verbose: body.verbose ?? false,
      tasksDir: ctx.tasksDir,
    };

    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    runningLoops.set(taskName, { cancel });

    // Run loop in background
    runLoopAsync(taskName, taskDir, opts, () => cancelled, ctx.projectRoot)
      .catch((err) => {
        broadcast(taskName, { type: "error", message: String(err) });
      })
      .finally(() => {
        runningLoops.delete(taskName);
      });

    return { status: 200, body: { started: true } };
  }

  return { status: 404, body: { error: "Unknown action" } };
}

async function runLoopAsync(
  taskName: string,
  taskDir: string,
  opts: LoopOptions,
  isCancelled: () => boolean,
  projectRoot: string,
): Promise<void> {
  await runWithContext(createDefaultContext(), async () => {
    const storage = getStorage();

    // Init or resume state
    let currentState: State;
    const existingState = storage.read(join(taskDir, "state.json"));
    if (existingState !== null) {
      currentState = readState(taskDir);
      if (currentState.engine !== opts.engine || currentState.model !== opts.model) {
        currentState = { ...currentState, engine: opts.engine, model: opts.model };
        writeState(taskDir, currentState);
      }
    } else {
      currentState = buildInitialState({
        name: opts.name,
        prompt: opts.prompt,
        engine: opts.engine,
        model: opts.model,
      });
      writeState(taskDir, currentState);
    }

    broadcast(taskName, { type: "state", state: currentState });
    scaffoldTaskDocuments(taskDir);

    let iter = 0;
    const loopStartTime = Date.now();
    let consFailures = 0;
    let lastResult = "";

    while (!isCancelled()) {
      currentState = readState(taskDir);
      broadcast(taskName, { type: "state", state: currentState });

      const stop = checkStopCondition(currentState, iter, opts, loopStartTime, consFailures);
      if (stop !== null) {
        broadcast(taskName, { type: "stopped", reason: stop });
        break;
      }

      iter++;
      broadcast(taskName, {
        type: "info",
        text: `Iteration ${iter} — Phase: ${currentState.phase}`,
      });

      const progressContent = storage.read(join(taskDir, "PROGRESS.md"));
      if (progressContent !== null) {
        const progress = countProgress(progressContent);
        const items = parseProgressItems(progressContent);
        broadcast(taskName, { type: "progress", progress, items });
      }

      const phaseBeforeEngine = currentState.phase;
      const prompt = buildTaskPrompt(currentState, taskDir);
      const iterStart = new Date().toISOString();

      try {
        const onFeedEvent = (event: FeedEvent) => {
          broadcast(taskName, { type: "feed", event });
        };

        // Create an AbortController so steering can kill this iteration
        const ac = new AbortController();
        engineAbortControllers.set(taskName, ac);
        pendingSteerMessages.delete(taskName);

        let engineResult = await runEngine({
          engine: opts.engine,
          model: opts.model,
          prompt,
          logFlag: opts.log,
          taskDir,
          interactive: false,
          cwd: projectRoot,
          onFeedEvent,
          signal: ac.signal,
        });

        // Handle live steering: kill → resume with steering message
        while (pendingSteerMessages.has(taskName) && engineResult.sessionId) {
          const steerMessage = pendingSteerMessages.get(taskName)!;
          pendingSteerMessages.delete(taskName);

          broadcast(taskName, {
            type: "info",
            text: `Live steering: ${steerMessage}`,
          });

          const resumeAc = new AbortController();
          engineAbortControllers.set(taskName, resumeAc);

          // Filter out session init events on resume — they're noise
          const onResumeFeedEvent = (event: FeedEvent) => {
            if (event.type === "session" || event.type === "session-unknown") return;
            onFeedEvent(event);
          };

          const resumeResult = await runEngine({
            engine: opts.engine,
            model: opts.model,
            prompt: buildSteeringPrompt(steerMessage),
            logFlag: opts.log,
            taskDir,
            interactive: false,
            cwd: projectRoot,
            onFeedEvent: onResumeFeedEvent,
            signal: resumeAc.signal,
            resumeSessionId: engineResult.sessionId,
          });

          resumeResult.usage = mergeUsage(engineResult.usage, resumeResult.usage);
          engineResult = resumeResult;
        }

        engineAbortControllers.delete(taskName);

        if (engineResult.exitCode !== 0) {
          const failure = handleEngineFailure(engineResult.exitCode);
          broadcast(taskName, { type: "info", text: failure.message });

          const result = `failed:exit-${engineResult.exitCode}`;
          updateStateIteration(
            taskDir,
            result,
            iterStart,
            opts.engine,
            opts.model,
            engineResult.usage,
          );

          if (result === lastResult) {
            consFailures++;
          } else {
            consFailures = 1;
            lastResult = result;
          }
          continue;
        }

        // Success
        currentState = updateStateIteration(
          taskDir,
          "success",
          iterStart,
          opts.engine,
          opts.model,
          engineResult.usage,
        );
        broadcast(taskName, { type: "state", state: currentState });
        consFailures = 0;
        lastResult = "";

        // Broadcast updated progress after iteration
        const postProgressContent = storage.read(join(taskDir, "PROGRESS.md"));
        if (postProgressContent !== null) {
          const postProgress = countProgress(postProgressContent);
          const postItems = parseProgressItems(postProgressContent);
          broadcast(taskName, { type: "progress", progress: postProgress, items: postItems });
        }

        if (currentState.phase === phaseBeforeEngine) {
          currentState = autoTransitionAfterIteration(currentState, taskDir);
        }
        broadcast(taskName, { type: "state", state: currentState });

        try {
          gitPush();
        } catch {
          // Non-fatal
        }

        const stopSignal = checkStopSignal(taskDir);
        if (stopSignal) {
          broadcast(taskName, { type: "stopped", reason: "signal" });
          break;
        }

        // Delay between iterations
        if (
          checkStopCondition(currentState, iter, opts, loopStartTime, consFailures) === null &&
          opts.delay > 0
        ) {
          await new Promise((resolve) => setTimeout(resolve, opts.delay * 1000));
        }
      } catch (err) {
        broadcast(taskName, { type: "error", message: String(err) });
        break;
      }
    }

    // Final state
    currentState = readState(taskDir);
    if (currentState.status === "completed") {
      const now = new Date().toISOString();
      currentState = {
        ...currentState,
        lastModified: now,
        history: [
          ...currentState.history,
          {
            timestamp: now,
            phase: "done",
            iteration: 0,
            engine: currentState.engine,
            model: currentState.model,
            result: "task completed",
          },
        ],
      };
      writeState(taskDir, currentState);
    }

    broadcast(taskName, { type: "state", state: currentState });

    if (iter > 0) {
      commitTaskDir(taskDir, `task ${opts.name} finished`);
      try {
        gitPush();
      } catch {
        // Non-fatal
      }
    }

    broadcast(taskName, { type: "stopped", reason: "finished" });
  });
}
