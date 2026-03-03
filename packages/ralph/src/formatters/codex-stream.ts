import chalk from "chalk";

export interface CodexStreamOptions {
  verbose?: boolean;
}

export interface CodexStreamResult {
  rateLimited: boolean;
  printingText: boolean;
  pendingTools: number;
}

const TOOL_TYPES = new Set([
  "mcp_tool_call",
  "tool_call",
  "function_call",
  "computer_call",
  "command_execution",
]);

function isToolType(t: string): boolean {
  return TOOL_TYPES.has(t);
}

function shortenInline(text: string, max = 140): string {
  const collapsed = text.replace(/[\n\r]+/g, " ").replace(/\s+/g, " ").trim();
  if (collapsed.length > max) return collapsed.slice(0, max) + "...";
  return collapsed;
}

function extractToolName(event: Record<string, unknown>): string {
  const item = (event.item ?? {}) as Record<string, unknown>;
  const rawItem = (item.raw_item ?? {}) as Record<string, unknown>;
  const itemCall = (item.call ?? {}) as Record<string, unknown>;
  const rawCall = (rawItem.call ?? {}) as Record<string, unknown>;
  const itemFunc = (item.function ?? {}) as Record<string, unknown>;
  const rawFunc = (rawItem.function ?? {}) as Record<string, unknown>;
  const itemTool = item.tool as Record<string, unknown> | string | undefined;
  const rawTool = rawItem.tool as Record<string, unknown> | string | undefined;

  const candidates: unknown[] = [
    event.name,
    event.tool_name,
    (event.tool as Record<string, unknown> | undefined)?.name,
    event.tool,
    item.name,
    item.tool_name,
    typeof itemTool === "object" && itemTool ? itemTool.name : itemTool,
    rawItem.name,
    rawItem.tool_name,
    rawItem.recipient_name,
    typeof rawTool === "object" && rawTool ? rawTool.name : rawTool,
    itemCall.name,
    rawCall.name,
    itemFunc.name,
    rawFunc.name,
  ];

  const name = candidates.find(
    (c) => typeof c === "string" && c.length > 0,
  ) as string | undefined;

  const server = ((item.server as string) ?? (event.server as string) ?? "");
  if (server && name) return `${server}/${name}`;
  return name ?? "";
}

function extractToolInputSummary(event: Record<string, unknown>): string {
  const item = (event.item ?? {}) as Record<string, unknown>;
  const rawItem = (item.raw_item ?? {}) as Record<string, unknown>;
  const itemCall = (item.call ?? {}) as Record<string, unknown>;
  const rawCall = (rawItem.call ?? {}) as Record<string, unknown>;
  const itemFunc = (item.function ?? {}) as Record<string, unknown>;
  const rawFunc = (rawItem.function ?? {}) as Record<string, unknown>;

  const candidates: unknown[] = [
    item.command,
    event.command,
    event.arguments,
    event.input,
    item.arguments,
    item.input,
    rawItem.arguments,
    rawItem.input,
    itemCall.arguments,
    rawCall.arguments,
    itemFunc.arguments,
    rawFunc.arguments,
  ];

  const val = candidates.find((c) => c !== undefined && c !== null);
  if (val === undefined || val === null) return "";
  const raw = typeof val === "string" ? val : JSON.stringify(val);
  return shortenInline(raw, 160);
}

function extractToolResultSummary(event: Record<string, unknown>): string {
  const item = (event.item ?? {}) as Record<string, unknown>;
  const rawItem = (item.raw_item ?? {}) as Record<string, unknown>;
  const itemCall = (item.call ?? {}) as Record<string, unknown>;
  const rawCall = (rawItem.call ?? {}) as Record<string, unknown>;
  const itemError = (item.error ?? {}) as Record<string, unknown>;
  const eventError = (event.error ?? {}) as Record<string, unknown>;

  const candidates: unknown[] = [
    itemError.message,
    eventError.message,
    item.aggregated_output,
    event.aggregated_output,
    event.output,
    event.result,
    event.content,
    item.output,
    item.result,
    item.content,
    rawItem.output,
    rawItem.result,
    rawItem.content,
    itemCall.output,
    rawCall.output,
  ];

  const val = candidates.find((c) => c !== undefined && c !== null);
  if (val === undefined || val === null) return "";
  const raw = typeof val === "string" ? val : JSON.stringify(val);
  return shortenInline(raw, 160);
}

function extractThinkingText(event: Record<string, unknown>): string {
  const item = (event.item ?? {}) as Record<string, unknown>;
  const rawItem = (item.raw_item ?? {}) as Record<string, unknown>;
  const candidates: unknown[] = [
    event.delta,
    event.text,
    event.summary,
    event.reasoning,
    event.message,
    item.delta,
    item.text,
    item.summary,
    item.reasoning,
    rawItem.delta,
    rawItem.text,
    rawItem.summary,
    rawItem.reasoning,
  ];
  const val = candidates.find(
    (c) => typeof c === "string" && c.length > 0,
  ) as string | undefined;
  return val ?? "";
}

function extractMessageText(event: Record<string, unknown>): string {
  const item = (event.item ?? {}) as Record<string, unknown>;
  const rawItem = (item.raw_item ?? {}) as Record<string, unknown>;
  const itemType =
    (item.type as string) ?? (rawItem.type as string) ?? "";

  if (itemType === "agent_message") {
    return (item.text as string) ?? "";
  }

  if (itemType === "message") {
    const content = (item.content ?? rawItem.content ?? []) as Array<
      Record<string, unknown>
    >;
    return content
      .filter((c) => {
        const t = (c.type as string) ?? "";
        return t === "output_text" || t === "text" || t === "summary_text";
      })
      .map((c) => (c.text as string) ?? (c.value as string) ?? "")
      .join("");
  }

  return "";
}

function isImportantNonJson(line: string): boolean {
  return /panicked at|thread .+ panicked|(^|\s)error([\s:]|$)|failed|exception|traceback|fatal/i.test(
    line,
  );
}

/**
 * Process a single line of Codex JSONL output.
 * Returns output lines to print and updated state.
 */
export function processCodexLine(
  line: string,
  state: { printingText: boolean; rateLimited: boolean; pendingTools: number },
  options: CodexStreamOptions = {},
): string[] {
  const verbose = options.verbose ?? false;
  const output: string[] = [];

  if (!line.trim()) return output;

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(line);
  } catch {
    // Non-JSON line handling
    if (/hit your limit/i.test(line)) {
      state.rateLimited = true;
      output.push(
        `\n${chalk.red.bold("✗ Rate limit reached")} ${chalk.red(line)}`,
      );
    } else if (isImportantNonJson(line)) {
      output.push(`${chalk.red.bold("stderr:")} ${chalk.red(line)}`);
    } else if (verbose) {
      output.push(chalk.gray(line));
    }
    return output;
  }

  const type = event.type as string | undefined;
  if (!type) return output;

  switch (type) {
    case "thread.started": {
      const tid = ((event.thread_id as string) ?? "").slice(0, 8);
      output.push(
        `${chalk.gray("──")} ${chalk.bold("codex")} ${chalk.gray(`(${tid}...)`)}`,
      );
      break;
    }

    case "turn.started":
      output.push(`\n${chalk.bold("▶ turn started")}`);
      break;

    case "turn.completed": {
      const usage = event.usage as Record<string, number> | undefined;
      if (state.printingText) {
        output.push(""); // newline
        state.printingText = false;
      }
      if (usage) {
        const info = `in=${usage.input_tokens ?? 0}  out=${usage.output_tokens ?? 0}`;
        output.push(`\n${chalk.green("✓ done")}  ${chalk.dim(info)}`);
      } else {
        output.push(`\n${chalk.green("✓ done")}`);
      }
      break;
    }

    case "turn.failed": {
      const err =
        ((event.error as Record<string, unknown>)?.message as string) ??
        (event.message as string) ??
        "unknown error";
      if (state.printingText) {
        output.push("");
        state.printingText = false;
      }
      output.push(`\n${chalk.red.bold("✗ Error")} ${chalk.red(err)}`);
      break;
    }

    case "error": {
      const msg = (event.message as string) ?? "unknown error";
      if (/hit your limit/i.test(msg)) {
        state.rateLimited = true;
        output.push(
          `${chalk.red.bold("✗ Rate limit reached")} ${chalk.red(msg)}`,
        );
      } else {
        output.push(`${chalk.red("error:")} ${msg}`);
      }
      break;
    }

    case "response.output_text.delta":
    case "assistant.message.delta":
    case "message.delta":
    case "output_text.delta": {
      const delta =
        (event.delta as string) ??
        (event.text as string) ??
        (event.message as string) ??
        "";
      if (delta) {
        if (!state.printingText) {
          output.push(`\n${chalk.bold(delta)}`);
          state.printingText = true;
        } else {
          output.push(chalk.bold(delta));
        }
      }
      break;
    }

    case "response.output_text.done":
    case "assistant.message.completed":
    case "message.completed":
    case "output_text.done": {
      const doneText = (event.text as string) ?? "";
      if (doneText) {
        if (!state.printingText) {
          output.push(`\n${chalk.bold(doneText)}`);
        } else {
          output.push(chalk.bold(doneText));
        }
      }
      state.printingText = false;
      break;
    }

    case "response.reasoning.delta":
    case "reasoning.delta":
    case "thinking.delta":
    case "assistant.thinking.delta":
    case "response.reasoning_summary.delta":
    case "response.reasoning_summary_text.delta": {
      const think = extractThinkingText(event);
      if (think) {
        if (state.printingText) {
          output.push("");
          state.printingText = false;
        }
        output.push(
          `  ${chalk.gray("thinking:")} ${chalk.dim(think)}`,
        );
      }
      break;
    }

    case "tool.started":
    case "tool.call.started":
    case "item.started": {
      let name = extractToolName(event);
      const inputSummary = extractToolInputSummary(event);
      const itemType =
        ((event.item as Record<string, unknown>)?.type as string) ??
        ((event.item as Record<string, unknown>)?.raw_item as Record<string, unknown>)?.type as string ??
        "";
      if (!name && itemType === "command_execution") name = "shell";
      if (name) {
        if (inputSummary) {
          output.push(
            `  ${chalk.cyan("▶")} ${chalk.cyan(name)} ${chalk.dim(inputSummary)}`,
          );
        } else {
          output.push(`  ${chalk.cyan("▶")} ${chalk.cyan(name)}`);
        }
        state.pendingTools++;
      }
      break;
    }

    case "response.output_item.added":
    case "item.added": {
      const msgText = extractMessageText(event);
      if (msgText) {
        if (!state.printingText) {
          output.push(`\n${chalk.bold(msgText)}`);
        } else {
          output.push(chalk.bold(msgText));
        }
        state.printingText = false;
      }

      const itemType =
        ((event.item as Record<string, unknown>)?.type as string) ??
        (
          (event.item as Record<string, unknown>)?.raw_item as
            | Record<string, unknown>
            | undefined
        )?.type as string ??
        "";
      let name = extractToolName(event);
      const inputSummary = extractToolInputSummary(event);
      if (name || isToolType(itemType)) {
        if (!name) name = itemType || "tool_call";
        if (inputSummary) {
          output.push(
            `  ${chalk.cyan("▶")} ${chalk.cyan(name)} ${chalk.dim(inputSummary)}`,
          );
        } else {
          output.push(`  ${chalk.cyan("▶")} ${chalk.cyan(name)}`);
        }
        state.pendingTools++;
      }
      break;
    }

    case "tool.completed":
    case "tool.call.completed":
    case "item.completed":
    case "response.output_item.done": {
      const msgText = extractMessageText(event);
      if (msgText) {
        if (!state.printingText) {
          output.push(`\n${chalk.bold(msgText)}`);
        } else {
          output.push(chalk.bold(msgText));
        }
        state.printingText = false;
      }

      const itemType =
        ((event.item as Record<string, unknown>)?.type as string) ??
        (
          (event.item as Record<string, unknown>)?.raw_item as
            | Record<string, unknown>
            | undefined
        )?.type as string ??
        "";

      if (itemType === "reasoning") {
        const think = extractThinkingText(event);
        if (think) {
          if (state.printingText) {
            output.push("");
            state.printingText = false;
          }
          output.push(
            `  ${chalk.gray("thinking:")} ${chalk.dim(think)}`,
          );
        }
      }

      const toolName = extractToolName(event);
      const resultSummary = extractToolResultSummary(event);
      const hasToolIdentity =
        toolName.length > 0 || isToolType(itemType);

      if (hasToolIdentity) {
        const displayName = toolName || itemType || "tool_call";
        if (toolName) {
          if (resultSummary) {
            output.push(
              ` ${chalk.green("✓")} ${chalk.dim(displayName)} ${chalk.dim(`→ ${shortenInline(resultSummary, 140)}`)}`,
            );
          } else {
            output.push(
              ` ${chalk.green("✓")} ${chalk.dim(displayName)}`,
            );
          }
        } else if (isToolType(itemType)) {
          if (verbose) {
            if (resultSummary) {
              output.push(
                ` ${chalk.green("✓")} ${chalk.dim(displayName)} ${chalk.dim(`→ ${shortenInline(resultSummary, 140)}`)}`,
              );
            } else {
              output.push(
                ` ${chalk.green("✓")} ${chalk.dim(displayName)}`,
              );
            }
          } else if (state.pendingTools > 0) {
            output.push(` ${chalk.green("✓")}`);
          }
        } else {
          output.push(` ${chalk.green("✓")}`);
        }
        if (state.pendingTools > 0) state.pendingTools--;
      }
      break;
    }

    case "response.completed": {
      const response = (event.response ?? {}) as Record<string, unknown>;
      const responseOutput = (response.output ?? []) as Array<
        Record<string, unknown>
      >;
      const finalTexts: string[] = [];
      for (const item of responseOutput) {
        if ((item.type as string) !== "message") continue;
        const content = (item.content ?? []) as Array<
          Record<string, unknown>
        >;
        for (const c of content) {
          const ct = (c.type as string) ?? "";
          if (ct === "output_text" || ct === "text") {
            const text = (c.text as string) ?? "";
            if (text) finalTexts.push(text);
          }
        }
      }
      const finalText = finalTexts.join("");
      if (finalText) {
        if (!state.printingText) {
          output.push(`\n${chalk.bold(finalText)}`);
        } else {
          output.push(chalk.bold(finalText));
        }
        state.printingText = false;
      }
      break;
    }

    default:
      if (verbose) {
        const preview = JSON.stringify(event).slice(0, 220);
        output.push(chalk.dim(`${type}: ${preview}`));
      }
      break;
  }

  return output;
}

/**
 * Format a complete Codex JSONL output.
 * Processes each line and returns the formatted output and result state.
 */
export function formatCodexStream(
  input: string,
  options: CodexStreamOptions = {},
): { output: string; result: CodexStreamResult } {
  const state = {
    printingText: false,
    rateLimited: false,
    pendingTools: 0,
  };

  const allOutput: string[] = [];
  for (const line of input.split("\n")) {
    const lines = processCodexLine(line, state, options);
    allOutput.push(...lines);
  }

  if (state.printingText) {
    allOutput.push(""); // final newline
  }

  return {
    output: allOutput.join("\n"),
    result: {
      rateLimited: state.rateLimited,
      printingText: state.printingText,
      pendingTools: state.pendingTools,
    },
  };
}
