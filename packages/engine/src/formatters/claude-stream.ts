import { styled } from "@ralphy/output";
import type { IterationUsage } from "@ralphy/types";

export interface ClaudeStreamOptions {
  verbose?: boolean;
  logDir?: string;
}

export interface ClaudeStreamResult {
  gotResult: boolean;
  turnCount: number;
  toolCount: number;
  usage: IterationUsage | null;
}

const SEP = styled("━".repeat(50), "gray");

function formatCost(usd: number): string {
  return (Math.round(usd * 100) / 100).toFixed(2);
}

function extractToolInputSummary(input: Record<string, unknown>): string {
  if (typeof input.file_path === "string") {
    const parts = input.file_path.split("/");
    return `📄 ${parts[parts.length - 1]}`;
  }
  if (typeof input.command === "string") {
    return `$ ${input.command.split("\n")[0]}`;
  }
  if (typeof input.pattern === "string") {
    const inPath = typeof input.path === "string" ? ` in ${input.path.split("/").pop()}` : "";
    return `🔍 ${input.pattern}${inPath}`;
  }
  if (typeof input.query === "string") return `🔍 ${input.query}`;
  if (typeof input.url === "string") return `🌐 ${input.url}`;
  if (typeof input.prompt === "string") return `💬 ${input.prompt.split("\n")[0]}`;
  if (input.old_string !== undefined) return "✏️  edit";
  if (input.content !== undefined) return "📝 write";
  return "";
}

function extractUsage(event: Record<string, unknown>): IterationUsage {
  const usage = (event.usage ?? {}) as Record<string, number>;
  return {
    cost_usd: Math.round(((event.total_cost_usd as number) ?? 0) * 100) / 100,
    duration_ms: (event.duration_ms as number) ?? 0,
    num_turns: (event.num_turns as number) ?? 0,
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
  };
}

/**
 * Process a single line of Claude stream-json output.
 * Returns output lines to print and updated state.
 */
export function processClaudeLine(
  line: string,
  state: {
    turnCount: number;
    toolCount: number;
    gotResult: boolean;
    usage: IterationUsage | null;
  },
  options: ClaudeStreamOptions = {},
): string[] {
  const verbose = options.verbose ?? false;
  const output: string[] = [];

  if (!line.trim()) return output;

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(line);
  } catch {
    return output;
  }

  const type = event.type as string | undefined;
  if (!type) return output;

  switch (type) {
    case "system": {
      const subtype = (event.subtype as string) ?? "";
      if (subtype === "init") {
        const model = (event.model as string) ?? "unknown";
        const sid = ((event.session_id as string) ?? "").slice(0, 8);
        if (model === "unknown") {
          if (verbose) {
            output.push(
              `${styled("⚠ FAILED TO PARSE MODEL", "fail")} ${styled(`(${sid}…)`, "dim")}`,
            );
            output.push(
              styled(
                "  Check log file for raw JSON output. Run with --log to capture full output.",
                "dim",
              ),
            );
          } else {
            output.push(
              `${styled("✗", "error")} ${styled("UNKNOWN", "bold")} ${styled(`(${sid}…) - see --log`, "dim")}`,
            );
          }
        } else {
          if (verbose) {
            const ver = (event.claude_code_version as string) ?? "";
            const ntools = Array.isArray(event.tools) ? event.tools.length : 0;
            output.push(SEP);
            output.push(
              `  ${styled("model:", "dim")} ${styled(model, "bold")}  ${styled(`session: ${sid}…  v${ver}  tools: ${ntools}`, "dim")}`,
            );
            output.push(SEP);
          } else {
            output.push(
              `${styled("──", "gray")} ${styled(model, "bold")} ${styled(`(${sid}…)`, "gray")}`,
            );
          }
        }
      } else if (subtype === "task_started" && verbose) {
        const desc = (event.description as string) ?? "";
        if (desc) output.push(`  ${styled(`⊳ agent: ${desc}`, "dim")}`);
      }
      break;
    }

    case "assistant": {
      state.turnCount++;
      const message = event.message as Record<string, unknown> | undefined;
      const content = (message?.content ?? []) as Array<Record<string, unknown>>;
      for (const block of content) {
        const btype = block.type as string;
        if (btype === "text") {
          const text = block.text as string;
          if (text) output.push(`\n${styled(text, "bold")}`);
        } else if (btype === "tool_use") {
          state.toolCount++;
          const name = (block.name as string) ?? "?";
          const inputSummary = extractToolInputSummary(
            (block.input ?? {}) as Record<string, unknown>,
          );
          if (verbose) {
            output.push(`\n  ${styled(`▶ ${name}`, "header")}`);
            if (inputSummary) output.push(`    ${styled(inputSummary, "dim")}`);
          } else {
            let line = `  ${styled("▶", "cyan")} ${styled(name, "cyan")}`;
            if (inputSummary) line += ` ${styled(inputSummary, "dim")}`;
            output.push(line);
          }
        } else if (btype === "thinking") {
          if (verbose) {
            const thinking = (block.thinking as string) ?? "";
            if (thinking) {
              const lines = thinking.split("\n");
              output.push(`\n  ${styled("💭 thinking", "gray")}`);
              for (const tl of lines.slice(0, 3)) {
                output.push(`  ${styled(tl, "gray")}`);
              }
              if (lines.length > 3) {
                output.push(`  ${styled(`  … (${lines.length - 3} more lines)`, "gray")}`);
              }
            }
          } else {
            output.push(`  ${styled("💭", "gray")}`);
          }
        }
      }
      break;
    }

    case "user": {
      if (verbose) {
        const message = event.message as Record<string, unknown> | undefined;
        const content = (message?.content ?? []) as Array<Record<string, unknown>>;
        for (const block of content) {
          if ((block.type as string) === "tool_result") {
            let resultText = "";
            const blockContent = block.content;
            if (typeof blockContent === "string") {
              resultText = blockContent;
            } else if (Array.isArray(blockContent)) {
              resultText = blockContent
                .filter((c: Record<string, unknown>) => (c.type as string) === "text")
                .map((c: Record<string, unknown>) => c.text as string)
                .join("\n");
            }
            if (resultText) {
              const lines = resultText.split("\n");
              const preview = lines.slice(0, 6);
              for (const pl of preview) {
                output.push(`    ${styled(pl, "dim")}`);
              }
              if (lines.length > 6) {
                output.push(`    ${styled(`… (${lines.length - 6} more lines)`, "dim")}`);
              }
            }
          }
        }
      } else {
        output.push(` ${styled("✓", "success")}`);
      }
      break;
    }

    case "result": {
      state.gotResult = true;
      const usage = extractUsage(event);
      state.usage = usage;
      const info = [
        `cost=$${formatCost(usage.cost_usd)}`,
        `time=${Math.round((usage.duration_ms / 1000) * 10) / 10}s`,
        `turns=${usage.num_turns}`,
        `in=${usage.input_tokens}`,
        `out=${usage.output_tokens}`,
        `cached=${usage.cache_read_input_tokens}`,
      ].join("  ");

      const subtype = (event.subtype as string) ?? "unknown";
      if (subtype === "error") {
        const errmsg = (event.result as string) ?? "unknown error";
        output.push(`\n${styled("✗ Error", "fail")} ${styled(errmsg, "error")}`);
      } else {
        if (verbose) {
          output.push(`\n${styled("✓ Done", "successBold")}  ${styled(info, "dim")}`);
          output.push(`${SEP}\n`);
        } else {
          output.push(`\n${styled("✓ done", "success")}  ${styled(info, "dim")}`);
        }
      }
      break;
    }
  }

  return output;
}

/**
 * Format a complete Claude stream-json output.
 * Processes each line and returns the formatted output and result state.
 */
export function formatClaudeStream(
  input: string,
  options: ClaudeStreamOptions = {},
): { output: string; result: ClaudeStreamResult } {
  const state = {
    turnCount: 0,
    toolCount: 0,
    gotResult: false,
    usage: null as IterationUsage | null,
  };

  const allOutput: string[] = [];
  for (const line of input.split("\n")) {
    const lines = processClaudeLine(line, state, options);
    allOutput.push(...lines);
  }

  if (!state.gotResult) {
    allOutput.push("");
    allOutput.push(
      `${styled("✗ Stream interrupted", "fail")}  ${styled("(no result received — Claude may have hit usage limits or been interrupted)", "dim")}`,
    );
    if (options.verbose) {
      allOutput.push(styled(`  turns=${state.turnCount}  tools=${state.toolCount}`, "dim"));
      allOutput.push(SEP);
    }
  }

  return {
    output: allOutput.join("\n"),
    result: {
      gotResult: state.gotResult,
      turnCount: state.turnCount,
      toolCount: state.toolCount,
      usage: state.usage,
    },
  };
}
