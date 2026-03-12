import { useEffect, type ReactNode } from "react";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { Text, useApp } from "ink";
import type { ParsedArgs } from "../cli";
import type { Phase } from "@ralphy/types";
import { readState, ensureState, writeState } from "@ralphy/core/state";
import { advancePhase, setPhase } from "@ralphy/core/phases";
import { commitState } from "@ralphy/core/git";
import { TaskList } from "./TaskList";
import { TaskStatus } from "./TaskStatus";
import { TaskLoop } from "./TaskLoop";

export interface AppProps {
  args: ParsedArgs;
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

export function App({ args, tasksDir }: AppProps) {
  switch (args.mode) {
    case "list":
      return <TaskList tasksDir={tasksDir} />;

    case "status": {
      if (!args.name) {
        return <ErrorMessage message="Error: --name is required for status mode" />;
      }
      const taskDir = join(tasksDir, args.name);
      if (!existsSync(join(taskDir, "state.json"))) {
        return <ErrorMessage message={`Error: task '${args.name}' not found`} />;
      }
      const state = readState(taskDir);
      return (
        <ExitAfterRender>
          <TaskStatus state={state} taskDir={taskDir} />
        </ExitAfterRender>
      );
    }

    case "advance": {
      if (!args.name) {
        return <ErrorMessage message="Error: --name is required for advance mode" />;
      }
      const taskDir = join(tasksDir, args.name);
      const state = ensureState(taskDir);
      const updated = advancePhase(state, taskDir);
      writeState(taskDir, updated);
      commitState(taskDir, `advance phase: ${state.phase} -> ${updated.phase}`);
      return (
        <ExitAfterRender>
          <Text>{`Advanced: ${state.phase} -> ${updated.phase}`}</Text>
        </ExitAfterRender>
      );
    }

    case "set-phase": {
      if (!args.name) {
        return <ErrorMessage message="Error: --name is required for set-phase mode" />;
      }
      if (!args.phase) {
        return <ErrorMessage message="Error: --phase is required for set-phase mode" />;
      }
      const taskDir = join(tasksDir, args.name);
      const state = ensureState(taskDir);
      const updated = setPhase(state, taskDir, args.phase as Phase);
      return (
        <ExitAfterRender>
          <Text>{`Set phase: ${state.phase} -> ${updated.phase}`}</Text>
        </ExitAfterRender>
      );
    }

    case "init":
      return (
        <ExitAfterRender>
          <Text color="green">Initialized .ralph directory</Text>
        </ExitAfterRender>
      );

    case "task": {
      if (!args.name) {
        return <ErrorMessage message="Error: --name is required for task mode" />;
      }
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
            noExecute: args.noExecute,
            interactive: args.interactive,
            delay: args.delay,
            log: args.log,
            verbose: args.verbose,
            tasksDir,
          }}
        />
      );
    }
  }
}
