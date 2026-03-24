import { Box, Text } from "ink";
import type { State } from "@ralphy/types";
import type { ProgressCount } from "@ralphy/core/progress";
import type { StopReason } from "../loop";

export interface StopMessageProps {
  reason: StopReason;
  state: State;
  taskDir: string;
  progress?: ProgressCount | null;
  maxIterations?: number;
  maxCostUsd?: number;
  maxRuntimeMinutes?: number;
  consecutiveFailures: number;
}

export function StopMessage({
  reason,
  state,
  taskDir,
  progress,
  maxIterations,
  maxCostUsd,
  maxRuntimeMinutes,
  consecutiveFailures,
}: StopMessageProps) {
  switch (reason) {
    case "terminal": {
      return (
        <Box flexDirection="column">
          {progress != null && (
            <Text>
              {"\n"}All items checked ({progress.checked} done / {progress.unchecked} remaining).
              Task complete!
            </Text>
          )}
          <Text>See: {taskDir}/PROGRESS.md</Text>
        </Box>
      );
    }
    case "noExecute":
      return (
        <Box flexDirection="column">
          <Text>
            {"\n"}Research and planning complete. Stopping before execution (--no-execute).
          </Text>
          <Text>
            See: {taskDir}/PLAN.md, {taskDir}/PROGRESS.md
          </Text>
        </Box>
      );
    case "maxIterations":
      return (
        <Text>
          {"\n"}Reached max iterations: {maxIterations}
        </Text>
      );
    case "costCap":
      return (
        <Text color="yellow" bold>
          {"\n"}Cost cap reached: ${state.usage.total_cost_usd.toFixed(2)} {">"}= ${maxCostUsd}{" "}
          limit
        </Text>
      );
    case "runtimeLimit":
      return (
        <Text color="yellow" bold>
          {"\n"}Runtime limit reached: {maxRuntimeMinutes} minute(s)
        </Text>
      );
    case "consecutiveFailures":
      return (
        <Text color="red" bold>
          {"\n"}Stopped: {consecutiveFailures} consecutive identical failures detected
        </Text>
      );
    case "rateLimited":
      return (
        <Text color="red" bold>
          {"\n"}Stopped: engine hit API rate/usage limit
        </Text>
      );
  }
}
