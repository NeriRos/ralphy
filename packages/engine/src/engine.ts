import { spawn } from "bun";
import { writeFileSync, unlinkSync, existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { type Engine, type IterationUsage } from "@ralphy/types";
import { processClaudeLine } from "./formatters/claude-stream";
import { processCodexLine } from "./formatters/codex-stream";

export interface RunEngineOptions {
  engine: Engine;
  model: string;
  prompt: string;
  logFlag?: boolean;
  taskDir?: string;
  interactive?: boolean;
}

export interface EngineResult {
  exitCode: number;
  usage: IterationUsage | null;
}

/**
 * Handle engine failure by exit code.
 * Returns a human-readable error message and whether the loop should stop.
 */
export function handleEngineFailure(exitCode: number): {
  message: string;
  shouldStop: boolean;
} {
  switch (exitCode) {
    case 42:
      return {
        message: "Rate limited — Codex rate limit hit. Stopping loop.",
        shouldStop: true,
      };
    case 130:
      return {
        message: "Interrupted (exit 130) — Claude hit usage limits or was cancelled (SIGINT).",
        shouldStop: false,
      };
    case 137:
      return {
        message: "Killed (exit 137) — Process was killed (SIGKILL / OOM).",
        shouldStop: false,
      };
    case 1:
      return {
        message: "Failed (exit 1) — Engine exited with a general error.",
        shouldStop: false,
      };
    default:
      return {
        message: `Failed (exit ${exitCode}) — Engine exited unexpectedly.`,
        shouldStop: false,
      };
  }
}

/**
 * Build the CLI arguments for the engine subprocess.
 */
function buildClaudeArgs(model: string): string[] {
  return [
    "-p",
    "-",
    "--dangerously-skip-permissions",
    "--model",
    model,
    "--output-format",
    "stream-json",
    "--verbose",
  ];
}

function buildCodexArgs(): string[] {
  return ["exec", "--json", "--color", "never", "--dangerously-bypass-approvals-and-sandbox", "-"];
}

/**
 * Spawn the engine CLI, pipe the prompt via stdin, and stream stdout
 * through the appropriate formatter. Prints formatted output to stdout
 * in real time.
 *
 * Returns the exit code and usage stats (for Claude).
 */
/**
 * Spawn Claude in interactive mode with inherited stdio.
 * The user can chat back and forth. Returns when the session ends.
 */
async function runInteractive(
  model: string,
  prompt: string,
  taskDir?: string,
): Promise<EngineResult> {
  // Write prompt to a temp file in the task dir so Claude can read it
  const promptFile = taskDir
    ? join(taskDir, "_interactive_prompt.md")
    : join(mkdtempSync(join(tmpdir(), "ralph-")), "prompt.md");
  writeFileSync(promptFile, prompt);

  try {
    const cmd = [
      "claude",
      "--model",
      model,
      "--dangerously-skip-permissions",
      [
        `Read the file ${promptFile} for background on the task.`,
        `Start by using /plan mode. Ask the user clarifying questions to deeply understand the requirements,`,
        `constraints, edge cases, and preferences. Do not rush — thorough understanding is the goal.`,
        `Once the user is satisfied and approves, call the ralph_finish_interactive MCP tool with the task name`,
        `and a comprehensive context summary of everything discussed: refined requirements, architectural decisions,`,
        `constraints, edge cases, and user preferences.`,
        `The automated loop will then run all phases (research, plan, exec, review) using this context.`,
        `After calling ralph_finish_interactive, use /exit immediately.`,
      ].join(" "),
    ];

    const proc = spawn({
      cmd,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });

    const exitCode = await proc.exited;

    // Check if the interactive session completed successfully via the MCP tool signal
    // Keep the file — the loop uses it to avoid re-entering interactive mode
    const doneFile = taskDir ? join(taskDir, "_interactive_done") : null;
    if (doneFile && existsSync(doneFile)) {
      return { exitCode: 0, usage: null };
    }

    return { exitCode, usage: null };
  } finally {
    try {
      unlinkSync(promptFile);
    } catch {
      // cleanup is best-effort
    }
  }
}

export async function runEngine(opts: RunEngineOptions): Promise<EngineResult> {
  const { engine, model, prompt } = opts;

  if (opts.interactive && engine === "claude") {
    return runInteractive(model, prompt, opts.taskDir);
  }

  const isClaude = engine === "claude";
  const cmd = isClaude ? ["claude", ...buildClaudeArgs(model)] : ["codex", ...buildCodexArgs()];

  const proc = spawn({
    cmd,
    stdin: "pipe",
    stdout: "pipe",
    stderr: isClaude ? "inherit" : "pipe",
  });

  // Write prompt to stdin for both engines
  const stdin = proc.stdin as import("bun").FileSink;
  stdin.write(new TextEncoder().encode(prompt));
  await stdin.flush();
  stdin.end();

  // Stream stdout line-by-line through the formatter
  const stdout = proc.stdout as ReadableStream<Uint8Array>;
  let usage: IterationUsage | null = null;

  if (engine === "claude") {
    const claudeState = {
      turnCount: 0,
      toolCount: 0,
      gotResult: false,
      usage: null as IterationUsage | null,
    };

    const reader = stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const output = processClaudeLine(line, claudeState);
        for (const l of output) {
          process.stdout.write(l + "\n");
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const output = processClaudeLine(buffer, claudeState);
      for (const l of output) {
        process.stdout.write(l + "\n");
      }
    }

    usage = claudeState.usage;
  } else {
    const codexState = {
      printingText: false,
      rateLimited: false,
      pendingTools: 0,
    };

    // Merge stdout and stderr for codex (codex uses stderr for some output)
    const reader = stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const output = processCodexLine(line, codexState);
        for (const l of output) {
          process.stdout.write(l + "\n");
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const output = processCodexLine(buffer, codexState);
      for (const l of output) {
        process.stdout.write(l + "\n");
      }
    }

    // Also drain stderr for codex
    if (proc.stderr) {
      const stderr = proc.stderr as ReadableStream<Uint8Array>;
      const stderrReader = stderr.getReader();
      const stderrDecoder = new TextDecoder();
      let stderrBuffer = "";

      while (true) {
        const { done, value } = await stderrReader.read();
        if (done) break;
        stderrBuffer += stderrDecoder.decode(value, { stream: true });

        const lines = stderrBuffer.split("\n");
        stderrBuffer = lines.pop() ?? "";

        for (const line of lines) {
          const output = processCodexLine(line, codexState);
          for (const l of output) {
            process.stdout.write(l + "\n");
          }
        }
      }

      if (stderrBuffer.trim()) {
        const output = processCodexLine(stderrBuffer, codexState);
        for (const l of output) {
          process.stdout.write(l + "\n");
        }
      }
    }
  }

  const exitCode = await proc.exited;

  return { exitCode, usage };
}
