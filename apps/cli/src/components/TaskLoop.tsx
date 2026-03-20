import { useState, useEffect, useRef, useMemo } from "react";
import { join } from "node:path";
import { Box, Static, Text, useApp } from "ink";
import { TextInput } from "@inkjs/ui";
import { Banner } from "./Banner";
import { IterationHeader } from "./IterationHeader";
import { FeedLine } from "./FeedLine";
import { StatusBar } from "./StatusBar";
import { StopMessage } from "./StopMessage";
import { useLoop, type LogEntry } from "../hooks/useLoop";
import type { LoopOptions } from "../loop";

export interface TaskLoopProps {
  opts: LoopOptions;
}

type FeedItem = { id: string; kind: "banner" } | { id: string; kind: "entry"; entry: LogEntry };

function LogLine({ entry, verbose }: { entry: LogEntry; verbose?: boolean | undefined }) {
  switch (entry.kind) {
    case "iterationHeader":
      return <IterationHeader iteration={entry.iteration} time={entry.time} />;
    case "info":
      return <Text dimColor> {entry.text}</Text>;
    case "feed":
      return <FeedLine event={entry.event} verbose={verbose} />;
  }
}

function SteerInput({ onSubmit }: { onSubmit: (msg: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <Box>
      <Text dimColor>steer: </Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={(v) => {
          const trimmed = v.trim();
          if (trimmed) {
            onSubmit(trimmed);
            setValue("");
          }
        }}
      />
    </Box>
  );
}

export function TaskLoop({ opts }: TaskLoopProps) {
  const { exit } = useApp();
  const loop = useLoop(opts);
  const bannerItem = useRef<FeedItem>({ id: "__banner__", kind: "banner" });

  const feedItems: FeedItem[] = useMemo(
    () => [
      bannerItem.current,
      ...loop.logLines.map((e) => ({ id: e.id, kind: "entry" as const, entry: e })),
    ],
    [loop.logLines],
  );

  useEffect(() => {
    if (!loop.isRunning) {
      exit();
    }
  }, [loop.isRunning, exit]);

  if (!loop.state) return null;

  const taskDir = join(opts.tasksDir, opts.name);

  return (
    <Box flexDirection="column">
      <Static items={feedItems}>
        {(item) => {
          if (item.kind === "banner") {
            return (
              <Banner
                key={item.id}
                state={loop.state!}
                mode="task"
                isResume={loop.isResume}
                noExecute={opts.noExecute}
                interactive={opts.interactive}
                maxIterations={opts.maxIterations}
                maxCostUsd={opts.maxCostUsd}
                maxRuntimeMinutes={opts.maxRuntimeMinutes}
                maxConsecutiveFailures={opts.maxConsecutiveFailures}
                iterationDelay={opts.delay}
                taskPrompt={opts.prompt || loop.state!.prompt}
              />
            );
          }
          return <LogLine key={item.id} entry={item.entry} verbose={opts.verbose} />;
        }}
      </Static>

      {loop.isRunning && (
        <>
          <StatusBar
            phase={loop.currentPhase}
            iteration={loop.iteration}
            progress={loop.progress}
            costUsd={loop.state.usage.total_cost_usd}
            startedAt={loop.startedAt}
            engine={opts.engine}
            model={opts.model}
            isRunning
          />
          <SteerInput onSubmit={loop.steer} />
        </>
      )}

      {loop.stopReason && (
        <>
          <StatusBar
            phase={loop.currentPhase}
            iteration={loop.iteration}
            progress={loop.progress}
            costUsd={loop.state.usage.total_cost_usd}
            startedAt={loop.startedAt}
            engine={opts.engine}
            model={opts.model}
            isRunning={false}
          />
          <StopMessage
            reason={loop.stopReason}
            state={loop.state}
            taskDir={taskDir}
            progress={loop.progress}
            maxIterations={opts.maxIterations}
            maxCostUsd={opts.maxCostUsd}
            maxRuntimeMinutes={opts.maxRuntimeMinutes}
            consecutiveFailures={loop.consecutiveFailures}
          />
        </>
      )}
    </Box>
  );
}
