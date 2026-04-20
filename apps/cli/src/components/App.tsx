import { useEffect, type ReactNode } from "react";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { Text, useApp } from "ink";
import type { ParsedArgs } from "../cli";
import { readState } from "@ralphy/core/state";
import { TaskList } from "./TaskList";
import { TaskStatus } from "./TaskStatus";
import { TaskLoop } from "./TaskLoop";
import { OpenSpecChangeStore } from "@ralphy/openspec";

export interface AppProps {
  args: ParsedArgs;
  statesDir: string;
  tasksDir: string;
}

function ExitAfterRender({ children }: { children: ReactNode }) {
  const { exit } = useApp();
  useEffect(() => {
    exit();
  }, [exit]);
  return <>{children}</>;
}

function ErrorMessage({ message }: { message: string }) {
  const { exit } = useApp();
  useEffect(() => {
    process.exitCode = 1;
    exit();
  }, [exit]);
  return <Text color="red">{message}</Text>;
}

export function App({ args, statesDir, tasksDir }: AppProps) {
  switch (args.mode) {
    case "list":
      return <TaskList statesDir={statesDir} />;

    case "status": {
      if (!args.name) {
        return <ErrorMessage message="Error: --name is required for status mode" />;
      }
      const stateDir = join(statesDir, args.name);
      if (!existsSync(join(stateDir, ".ralph-state.json"))) {
        return <ErrorMessage message={`Error: change '${args.name}' not found`} />;
      }
      const state = readState(stateDir);
      return (
        <ExitAfterRender>
          <TaskStatus state={state} stateDir={stateDir} />
        </ExitAfterRender>
      );
    }

    case "init":
      return (
        <ExitAfterRender>
          <Text color="green">Initialized openspec directory</Text>
        </ExitAfterRender>
      );

    case "task": {
      if (!args.name) {
        return <ErrorMessage message="Error: --name is required for task mode" />;
      }
      mkdirSync(join(statesDir, args.name), { recursive: true });
      mkdirSync(join(tasksDir, args.name), { recursive: true });
      return (
        <TaskLoop
          opts={{
            name: args.name,
            prompt: args.prompt,
            engine: args.engine,
            model: args.model,
            maxIterations: args.maxIterations,
            maxCostUsd: args.maxCostUsd,
            maxRuntimeMinutes: args.maxRuntimeMinutes,
            maxConsecutiveFailures: args.maxConsecutiveFailures,
            delay: args.delay,
            log: args.log,
            verbose: args.verbose,
            statesDir,
            tasksDir,
            changeStore: new OpenSpecChangeStore(),
          }}
        />
      );
    }
  }
}
