import { join } from "node:path";
import { Box, Text } from "ink";
import type { State } from "@ralphy/types";
import { countProgress } from "@ralphy/core/progress";
import { getStatusDocuments } from "@ralphy/core/documents";
import { getStorage } from "@ralphy/context";

export interface TaskStatusProps {
  state: State;
  taskDir: string;
}

const HEAVY_RULE = "============================================";
const LIGHT_RULE = "--------------------------------------------";

export function TaskStatus({ state, taskDir }: TaskStatusProps) {
  const storage = getStorage();

  const cost = Math.round(state.usage.total_cost_usd * 100) / 100;
  const time = Math.round((state.usage.total_duration_ms / 1000) * 10) / 10 + "s";

  const documents = getStatusDocuments().map((doc) => ({
    name: doc.name,
    exists: storage.read(join(taskDir, doc.name)) !== null,
  }));

  const progressContent = storage.read(join(taskDir, "PROGRESS.md"));
  const progress =
    progressContent !== null ? countProgress(progressContent) : null;

  const recent = state.history.slice(-10);

  return (
    <Box flexDirection="column">
      <Text>{HEAVY_RULE}</Text>
      <Text> Task Status: {state.name}</Text>
      <Text>{HEAVY_RULE}</Text>
      <Text> Phase:            {state.phase}</Text>
      <Text> Phase iteration:  {state.phaseIteration}</Text>
      <Text> Total iterations: {state.totalIterations}</Text>
      <Text> Status:           {state.status}</Text>
      <Text> Engine:           {state.engine} ({state.model})</Text>
      <Text> Created:          {state.createdAt}</Text>
      <Text> Last modified:    {state.lastModified}</Text>
      <Text> Branch:           {state.metadata.branch ?? "—"}</Text>
      <Text>{LIGHT_RULE}</Text>

      <Text> Usage:</Text>
      <Text>   Cost:           ${cost}</Text>
      <Text>   Time:           {time}</Text>
      <Text>   Turns:          {state.usage.total_turns}</Text>
      <Text>   Input tokens:   {state.usage.total_input_tokens}</Text>
      <Text>   Output tokens:  {state.usage.total_output_tokens}</Text>
      <Text>   Cached tokens:  {state.usage.total_cache_read_input_tokens}</Text>
      <Text>{LIGHT_RULE}</Text>

      <Text> Files:</Text>
      {documents.map((doc) => (
        <Text key={doc.name}>   {doc.exists ? "[x]" : "[ ]"} {doc.name}</Text>
      ))}

      {progress !== null && (
        <Text> Progress:         {progress.checked} done / {progress.unchecked} remaining</Text>
      )}

      <Text>{LIGHT_RULE}</Text>
      <Text> History (last 10):</Text>
      {recent.map((entry, i) => (
        <Text key={i}>
          {"   "}
          {entry.timestamp} | {entry.phase} iter {entry.iteration} | {entry.engine}/{entry.model} |{" "}
          {entry.result}
        </Text>
      ))}
      <Text>{HEAVY_RULE}</Text>
    </Box>
  );
}
