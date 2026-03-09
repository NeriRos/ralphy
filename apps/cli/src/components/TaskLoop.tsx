import { useEffect } from "react";
import { join } from "node:path";
import { Box, Static, Text, useApp } from "ink";
import { Spinner } from "@inkjs/ui";
import { Banner } from "./Banner";
import { IterationHeader } from "./IterationHeader";
import { StopMessage } from "./StopMessage";
import { useLoop, type LogEntry } from "../hooks/useLoop";
import type { LoopOptions } from "../loop";

export interface TaskLoopProps {
  opts: LoopOptions;
}

function LogLine({ entry }: { entry: LogEntry }) {
  if (entry.type === "iterationHeader") {
    return <IterationHeader iteration={entry.iteration!} time={entry.time!} />;
  }
  if (entry.type === "info") {
    return (
      <Text dimColor>
        {" "}
        {entry.text}
      </Text>
    );
  }
  return <Text>{entry.text}</Text>;
}

export function TaskLoop({ opts }: TaskLoopProps) {
  const { exit } = useApp();
  const loop = useLoop(opts);

  useEffect(() => {
    if (!loop.isRunning) {
      exit();
    }
  }, [loop.isRunning, exit]);

  if (!loop.state) return null;

  const taskDir = join(opts.tasksDir, opts.name);

  return (
    <Box flexDirection="column">
      <Banner
        state={loop.state}
        mode="task"
        isResume={loop.isResume}
        noExecute={opts.noExecute}
        interactive={opts.interactive}
        maxIterations={opts.maxIterations}
        maxCostUsd={opts.maxCostUsd}
        maxRuntimeMinutes={opts.maxRuntimeMinutes}
        maxConsecutiveFailures={opts.maxConsecutiveFailures}
        iterationDelay={opts.delay}
        taskPrompt={opts.prompt || loop.state.prompt}
      />

      <Static items={loop.logLines}>
        {(entry) => <LogLine key={entry.id} entry={entry} />}
      </Static>

      {loop.isRunning && (
        <Box>
          <Spinner
            label={`Phase: ${loop.currentPhase}${loop.progress ? ` — ${loop.progress.checked}/${loop.progress.total} done` : ""}`}
          />
        </Box>
      )}

      {loop.stopReason && (
        <StopMessage
          reason={loop.stopReason}
          state={loop.state}
          taskDir={taskDir}
          maxIterations={opts.maxIterations}
          maxCostUsd={opts.maxCostUsd}
          maxRuntimeMinutes={opts.maxRuntimeMinutes}
          consecutiveFailures={loop.consecutiveFailures}
        />
      )}
    </Box>
  );
}
