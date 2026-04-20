import { useEffect } from "react";
import { join } from "node:path";
import { Box, Text, useApp } from "ink";
import { getStorage } from "@ralphy/context";

/**
 * Count checked and unchecked task items in a markdown file.
 */
function countTaskItems(content: string): { checked: number; unchecked: number } {
  const checked = (content.match(/^- \[x\]/gm) ?? []).length;
  const unchecked = (content.match(/^- \[ \]/gm) ?? []).length;
  return { checked, unchecked };
}

export interface TaskListProps {
  changesDir: string;
}

interface TaskRow {
  name: string;
  phase: string;
  status: string;
  iters: string;
  progress: string;
  progressStyled: boolean;
  prompt: string;
}

function buildRows(changesDir: string): TaskRow[] {
  const storage = getStorage();
  const entries = storage.list(changesDir);
  const rows: TaskRow[] = [];

  for (const entry of entries) {
    const raw = storage.read(join(changesDir, entry, ".ralph-state.json"));
    if (raw === null) continue;

    let state: Record<string, unknown>;
    try {
      state = JSON.parse(raw);
    } catch {
      continue;
    }

    if (String(state.status ?? "") === "completed") continue;

    const promptRaw = String(state.prompt ?? "");
    const firstLine = promptRaw.split("\n").find((l) => l.trim() !== "") ?? "";

    let progress = "—";
    let progressStyled = true;
    const tasksContent = storage.read(join(changesDir, entry, "tasks.md"));
    if (tasksContent !== null) {
      const { checked, unchecked } = countTaskItems(tasksContent);
      const total = checked + unchecked;
      if (total > 0) {
        progress = `${checked}/${total}`;
        progressStyled = false;
      }
    }

    rows.push({
      name: String(state.name ?? entry),
      phase: String(state.status ?? "active"),
      status: String(state.status ?? "unknown"),
      iters: String(state.iteration ?? 0),
      progress,
      progressStyled,
      prompt: firstLine
        .replace(/^#+\s*/, "")
        .trim()
        .slice(0, 60),
    });
  }

  return rows;
}

export function TaskList({ changesDir }: TaskListProps) {
  const { exit } = useApp();

  useEffect(() => {
    exit();
  }, [exit]);

  const rows = buildRows(changesDir);

  if (rows.length === 0) {
    return (
      <Box flexDirection="column">
        <Text> </Text>
        <Text dimColor> No incomplete tasks.</Text>
        <Text> </Text>
      </Box>
    );
  }

  const cols = {
    name: Math.max(4, ...rows.map((r) => r.name.length)),
    phase: Math.max(5, ...rows.map((r) => r.phase.length)),
    status: Math.max(6, ...rows.map((r) => r.status.length)),
    iters: 5,
    progress: 8,
  };

  const ruleWidth = cols.name + cols.phase + cols.status + cols.iters + cols.progress + 60 + 10;

  return (
    <Box flexDirection="column">
      <Text> </Text>
      <Text>
        <Text bold>{"Name".padEnd(cols.name)}</Text>
        {"  "}
        <Text bold>{"Phase".padEnd(cols.phase)}</Text>
        {"  "}
        <Text bold>{"Status".padEnd(cols.status)}</Text>
        {"  "}
        <Text bold>{"Iters".padEnd(cols.iters)}</Text>
        {"  "}
        <Text bold>{"Progress".padEnd(cols.progress)}</Text>
        {"  "}
        <Text bold>Description</Text>
      </Text>
      <Text dimColor>{"─".repeat(ruleWidth)}</Text>
      {rows.map((row) => (
        <Text key={row.name}>
          <Text color="cyan">{row.name.padEnd(cols.name)}</Text>
          {"  "}
          {row.phase.padEnd(cols.phase)}
          {"  "}
          {row.status.padEnd(cols.status)}
          {"  "}
          {row.iters.padStart(cols.iters)}
          {"  "}
          {row.progressStyled ? (
            <Text dimColor>{row.progress.padStart(cols.progress)}</Text>
          ) : (
            row.progress.padStart(cols.progress)
          )}
          {"  "}
          <Text dimColor>{row.prompt}</Text>
        </Text>
      ))}
      <Text> </Text>
    </Box>
  );
}
