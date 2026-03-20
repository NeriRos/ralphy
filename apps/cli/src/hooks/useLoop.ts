import { useState, useEffect, useRef } from "react";
import { join } from "node:path";
import type { State } from "@ralphy/types";
import type { ProgressCount } from "@ralphy/core/progress";
import type { FeedEvent } from "@ralphy/engine/feed-events";
import { readState, writeState, buildInitialState } from "@ralphy/core/state";
import { extractCurrentSection, countProgress } from "@ralphy/core/progress";
import { scaffoldTaskDocuments } from "@ralphy/core/templates";
import { runEngine, handleEngineFailure } from "@ralphy/engine/engine";
import { autoTransitionAfterIteration } from "@ralphy/core/phases";
import { gitPush, commitTaskDir } from "@ralphy/core/git";
import { getStorage, runWithContext, createDefaultContext } from "@ralphy/context";
import {
  buildTaskPrompt,
  checkStopCondition,
  updateStateIteration,
  checkStopSignal,
  type StopReason,
  type LoopOptions,
} from "../loop";

export type LogEntry =
  | { id: string; kind: "iterationHeader"; iteration: number; time: string }
  | { id: string; kind: "info"; text: string }
  | { id: string; kind: "feed"; event: FeedEvent };

export interface UseLoopResult {
  state: State | null;
  iteration: number;
  consecutiveFailures: number;
  logLines: LogEntry[];
  currentPhase: string;
  progress: ProgressCount | null;
  stopReason: StopReason | null;
  isRunning: boolean;
  isResume: boolean;
  startedAt: number;
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export function useLoop(opts: LoopOptions): UseLoopResult {
  const [state, setState] = useState<State | null>(null);
  const [iteration, setIteration] = useState(0);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [logLines, setLogLines] = useState<LogEntry[]>([]);
  const [currentPhase, setCurrentPhase] = useState("");
  const [progress, setProgress] = useState<ProgressCount | null>(null);
  const [stopReason, setStopReason] = useState<StopReason | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [isResume, setIsResume] = useState(false);
  const [startedAt] = useState(() => Date.now());

  const lineIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const nextId = () => String(lineIdRef.current++);

    const addInfo = (text: string) => {
      setLogLines((prev) => [...prev, { id: nextId(), kind: "info", text }]);
    };

    const addIterationHeader = (iterNum: number, time: string) => {
      setLogLines((prev) => [
        ...prev,
        { id: nextId(), kind: "iterationHeader", iteration: iterNum, time },
      ]);
    };

    const addFeedEvent = (event: FeedEvent) => {
      setLogLines((prev) => [...prev, { id: nextId(), kind: "feed", event }]);
    };

    runWithContext(createDefaultContext(), async () => {
      const taskDir = join(opts.tasksDir, opts.name);
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

      setIsResume(currentState.totalIterations > 0);
      setState(currentState);
      setCurrentPhase(currentState.phase);

      scaffoldTaskDocuments(taskDir);

      let iter = 0;
      const loopStartTime = Date.now();
      let consFailures = 0;
      let lastResult = "";

      while (!cancelled) {
        currentState = readState(taskDir);
        setState(currentState);
        setCurrentPhase(currentState.phase);

        const stop = checkStopCondition(currentState, iter, opts, loopStartTime, consFailures);
        if (stop !== null) {
          setStopReason(stop);
          break;
        }

        iter++;
        setIteration(iter);

        const time = new Date().toLocaleTimeString("en-US", { hour12: false });
        addIterationHeader(iter, time);
        addInfo(`Phase: ${currentState.phase} (iteration ${currentState.phaseIteration})`);

        const progressContent = storage.read(join(taskDir, "PROGRESS.md"));
        if (progressContent !== null) {
          const section = extractCurrentSection(progressContent);
          if (section) {
            const firstLine = section.split("\n")[0];
            addInfo(`Section: ${firstLine}`);
          }
          const p = countProgress(progressContent);
          setProgress(p);
          addInfo(`Progress: ${p.checked} done / ${p.unchecked} remaining`);
        }

        const phaseBeforeEngine = currentState.phase;
        const prompt = buildTaskPrompt(currentState, taskDir);

        const iterStart = new Date().toISOString();
        try {
          const interactiveDone = storage.read(join(taskDir, "_interactive_done")) !== null;
          const isInteractivePhase =
            opts.interactive && currentState.phase === "research" && !interactiveDone;

          const engineResult = await runEngine({
            engine: opts.engine,
            model: opts.model,
            prompt,
            logFlag: opts.log,
            taskDir,
            interactive: isInteractivePhase,
            onFeedEvent: addFeedEvent,
          });

          if (engineResult.exitCode !== 0) {
            const failure = handleEngineFailure(engineResult.exitCode);
            addInfo(failure.message);

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
            setConsecutiveFailures(consFailures);

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
          setState(currentState);
          consFailures = 0;
          lastResult = "";
          setConsecutiveFailures(0);

          // Only auto-transition if the agent didn't already advance the phase
          // (e.g. via ralph_advance_phase MCP tool during the engine run).
          // Otherwise we'd double-transition, skipping the review engine run.
          if (currentState.phase === phaseBeforeEngine) {
            currentState = autoTransitionAfterIteration(currentState, taskDir);
          }
          setState(currentState);
          setCurrentPhase(currentState.phase);

          try {
            gitPush();
          } catch {
            // Push failures are non-fatal
          }

          const stopSignal = checkStopSignal(taskDir);
          if (stopSignal) {
            addInfo(`STOP signal: ${stopSignal.trim()}`);
            break;
          }

          addInfo(`Completed iteration ${iter}`);

          // Delay between iterations
          if (
            checkStopCondition(currentState, iter, opts, loopStartTime, consFailures) === null &&
            opts.delay > 0
          ) {
            addInfo(`Sleeping ${opts.delay}s before next iteration...`);
            await sleep(opts.delay);
          }
        } catch (err) {
          addInfo(`Engine error: ${err}`);
          break;
        }
      }

      // Cleanup
      storage.remove(join(taskDir, "_interactive_done"));
      const finalProgressContent = storage.read(join(taskDir, "PROGRESS.md"));
      if (finalProgressContent !== null) {
        setProgress(countProgress(finalProgressContent));
      }

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
      setState(currentState);

      addInfo(`Ralph loop finished after ${iter} iterations.`);

      if (iter > 0) {
        commitTaskDir(taskDir, `task ${opts.name} finished`);
        try {
          gitPush();
        } catch {
          // Push failures are non-fatal
        }
      }

      setIsRunning(false);
    });

    return () => {
      cancelled = true;
    };
    // Effect should only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    iteration,
    consecutiveFailures,
    logLines,
    currentPhase,
    progress,
    stopReason,
    isRunning,
    isResume,
    startedAt,
  };
}
