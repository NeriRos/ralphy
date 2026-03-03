import chalk from "chalk";

export interface ClaudeStreamOptions {
  verbose?: boolean;
  logDir?: string;
}

export interface ClaudeUsageStats {
  cost_usd: number;
  duration_ms: number;
  num_turns: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export interface ClaudeStreamResult {
  gotResult: boolean;
  turnCount: number;
  toolCount: number;
  usage: ClaudeUsageStats | null;
}

const SEP = chalk.gray("━".repeat(50));

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
    const inPath =
      typeof input.path === "string"
        ? ` in ${input.path.split("/").pop()}`
        : "";
    return `🔍 ${input.pattern}${inPath}`;
  }
  if (typeof input.query === "string") return `🔍 ${input.query}`;
  if (typeof input.url === "string") return `🌐 ${input.url}`;
  if (typeof input.prompt === "string")
    return `💬 ${input.prompt.split("\n")[0]}`;
  if (input.old_string !== undefined) return "✏️  edit";
  if (input.content !== undefined) return "📝 write";
  return "";
}

function extractUsage(event: Record<string, unknown>): ClaudeUsageStats {
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
  state: { turnCount: number; toolCount: number; gotResult: boolean; usage: ClaudeUsageStats | null },
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
              `${chalk.red.bold("⚠ FAILED TO PARSE MODEL")} ${chalk.dim(`(${sid}…)`)}`,
            );
            output.push(
              chalk.dim(
                "  Check log file for raw JSON output. Run with --log to capture full output.",
              ),
            );
          } else {
            output.push(
              `${chalk.red("✗")} ${chalk.bold("UNKNOWN")} ${chalk.dim(`(${sid}…) - see --log`)}`,
            );
          }
        } else {
          if (verbose) {
            const ver = (event.claude_code_version as string) ?? "";
            const ntools = Array.isArray(event.tools)
              ? event.tools.length
              : 0;
            output.push(SEP);
            output.push(
              `  ${chalk.dim("model:")} ${chalk.bold(model)}  ${chalk.dim(`session: ${sid}…  v${ver}  tools: ${ntools}`)}`,
            );
            output.push(SEP);
          } else {
            output.push(
              `${chalk.gray("──")} ${chalk.bold(model)} ${chalk.gray(`(${sid}…)`)}`,
            );
          }
        }
      } else if (subtype === "task_started" && verbose) {
        const desc = (event.description as string) ?? "";
        if (desc) output.push(`  ${chalk.dim(`⊳ agent: ${desc}`)}`);
      }
      break;
    }

    case "assistant": {
      state.turnCount++;
      const message = event.message as Record<string, unknown> | undefined;
      const content = (message?.content ?? []) as Array<
        Record<string, unknown>
      >;
      for (const block of content) {
        const btype = block.type as string;
        if (btype === "text") {
          const text = block.text as string;
          if (text) output.push(`\n${chalk.bold(text)}`);
        } else if (btype === "tool_use") {
          state.toolCount++;
          const name = (block.name as string) ?? "?";
          const inputSummary = extractToolInputSummary(
            (block.input ?? {}) as Record<string, unknown>,
          );
          if (verbose) {
            output.push(`\n  ${chalk.cyan.bold(`▶ ${name}`)}`);
            if (inputSummary) output.push(`    ${chalk.dim(inputSummary)}`);
          } else {
            let line = `  ${chalk.cyan("▶")} ${chalk.cyan(name)}`;
            if (inputSummary) line += ` ${chalk.dim(inputSummary)}`;
            output.push(line);
          }
        } else if (btype === "thinking") {
          if (verbose) {
            const thinking = (block.thinking as string) ?? "";
            if (thinking) {
              const lines = thinking.split("\n");
              output.push(`\n  ${chalk.gray.italic("💭 thinking")}`);
              for (const tl of lines.slice(0, 3)) {
                output.push(`  ${chalk.gray(tl)}`);
              }
              if (lines.length > 3) {
                output.push(
                  `  ${chalk.gray(`  … (${lines.length - 3} more lines)`)}`,
                );
              }
            }
          } else {
            output.push(`  ${chalk.gray("💭")}`);
          }
        }
      }
      break;
    }

    case "user": {
      if (verbose) {
        const message = event.message as Record<string, unknown> | undefined;
        const content = (message?.content ?? []) as Array<
          Record<string, unknown>
        >;
        for (const block of content) {
          if ((block.type as string) === "tool_result") {
            let resultText = "";
            const blockContent = block.content;
            if (typeof blockContent === "string") {
              resultText = blockContent;
            } else if (Array.isArray(blockContent)) {
              resultText = blockContent
                .filter(
                  (c: Record<string, unknown>) =>
                    (c.type as string) === "text",
                )
                .map((c: Record<string, unknown>) => c.text as string)
                .join("\n");
            }
            if (resultText) {
              const lines = resultText.split("\n");
              const preview = lines.slice(0, 6);
              for (const pl of preview) {
                output.push(`    ${chalk.dim(pl)}`);
              }
              if (lines.length > 6) {
                output.push(
                  `    ${chalk.dim(`… (${lines.length - 6} more lines)`)}`,
                );
              }
            }
          }
        }
      } else {
        output.push(` ${chalk.green("✓")}`);
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
        output.push(`\n${chalk.red.bold("✗ Error")} ${chalk.red(errmsg)}`);
      } else {
        if (verbose) {
          output.push(
            `\n${chalk.green.bold("✓ Done")}  ${chalk.dim(info)}`,
          );
          output.push(`${SEP}\n`);
        } else {
          output.push(`\n${chalk.green("✓ done")}  ${chalk.dim(info)}`);
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
    usage: null as ClaudeUsageStats | null,
  };

  const allOutput: string[] = [];
  for (const line of input.split("\n")) {
    const lines = processClaudeLine(line, state, options);
    allOutput.push(...lines);
  }

  if (!state.gotResult) {
    allOutput.push("");
    allOutput.push(
      `${chalk.red.bold("✗ Stream interrupted")}  ${chalk.dim("(no result received — Claude may have hit usage limits or been interrupted)")}`,
    );
    if (options.verbose) {
      allOutput.push(
        chalk.dim(`  turns=${state.turnCount}  tools=${state.toolCount}`),
      );
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
