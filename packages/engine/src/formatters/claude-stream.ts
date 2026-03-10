import type { IterationUsage } from "@ralphy/types";
import { type FeedEvent, renderFeedEvent } from "../feed-events";

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

export interface ClaudeStreamState {
  turnCount: number;
  toolCount: number;
  gotResult: boolean;
  usage: IterationUsage | null;
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
 * Parse a single line of Claude stream-json output into structured FeedEvents.
 */
export function parseClaudeLine(line: string, state: ClaudeStreamState): FeedEvent[] {
  if (!line.trim()) return [];

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(line);
  } catch {
    return [];
  }

  const type = event.type as string | undefined;
  if (!type) return [];

  const events: FeedEvent[] = [];

  switch (type) {
    case "system": {
      const subtype = (event.subtype as string) ?? "";
      if (subtype === "init") {
        const model = (event.model as string) ?? "unknown";
        const sid = ((event.session_id as string) ?? "").slice(0, 8);
        if (model === "unknown") {
          events.push({ type: "session-unknown", sessionId: sid });
        } else {
          const se: Extract<FeedEvent, { type: "session" }> = {
            type: "session",
            model,
            sessionId: sid,
          };
          if (typeof event.claude_code_version === "string") se.version = event.claude_code_version;
          if (Array.isArray(event.tools)) se.toolCount = event.tools.length;
          events.push(se);
        }
      } else if (subtype === "task_started") {
        const desc = (event.description as string) ?? "";
        if (desc) events.push({ type: "agent", description: desc });
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
          if (text) events.push({ type: "text", text });
        } else if (btype === "tool_use") {
          state.toolCount++;
          const name = (block.name as string) ?? "?";
          const summary = extractToolInputSummary((block.input ?? {}) as Record<string, unknown>);
          events.push({ type: "tool-start", name, summary });
        } else if (btype === "thinking") {
          const thinking = (block.thinking as string) ?? "";
          if (thinking) {
            const lines = thinking.split("\n");
            events.push({
              type: "thinking",
              preview: lines.slice(0, 3).join("\n"),
              totalLines: lines.length,
            });
          } else {
            events.push({ type: "thinking" });
          }
        }
      }
      break;
    }

    case "user": {
      const message = event.message as Record<string, unknown> | undefined;
      const content = (message?.content ?? []) as Array<Record<string, unknown>>;
      for (const block of content) {
        if ((block.type as string) === "tool_result") {
          // Always emit tool-end first
          events.push({ type: "tool-end" });

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
            const ev: Extract<FeedEvent, { type: "tool-result-preview" }> = {
              type: "tool-result-preview",
              lines: preview,
            };
            if (lines.length > 6) ev.truncated = lines.length - 6;
            events.push(ev);
          }
        }
      }
      break;
    }

    case "result": {
      state.gotResult = true;
      const usage = extractUsage(event);
      state.usage = usage;

      const subtype = (event.subtype as string) ?? "unknown";
      if (subtype === "error") {
        const errmsg = (event.result as string) ?? "unknown error";
        events.push({ type: "result-error", message: errmsg });
      } else {
        events.push({
          type: "result",
          cost: usage.cost_usd,
          timeMs: usage.duration_ms,
          turns: usage.num_turns,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          cached: usage.cache_read_input_tokens,
        });
      }
      break;
    }
  }

  return events;
}

/**
 * Process a single line of Claude stream-json output.
 * Returns chalk-styled output lines (backward compatible).
 */
export function processClaudeLine(
  line: string,
  state: ClaudeStreamState,
  options: ClaudeStreamOptions = {},
): string[] {
  const verbose = options.verbose ?? false;
  const events = parseClaudeLine(line, state);

  const output: string[] = [];
  for (const event of events) {
    if (!verbose && event.type === "tool-result-preview") continue;
    if (!verbose && event.type === "agent") continue;
    // Claude compact mode: thinking shows only 💭 (no preview text)
    if (!verbose && event.type === "thinking") {
      output.push(...renderFeedEvent({ type: "thinking" }, false));
      continue;
    }
    output.push(...renderFeedEvent(event, verbose));
  }

  return output;
}

/**
 * Format a complete Claude stream-json output.
 */
export function formatClaudeStream(
  input: string,
  options: ClaudeStreamOptions = {},
): { output: string; result: ClaudeStreamResult } {
  const state: ClaudeStreamState = {
    turnCount: 0,
    toolCount: 0,
    gotResult: false,
    usage: null,
  };

  const allOutput: string[] = [];
  for (const line of input.split("\n")) {
    const lines = processClaudeLine(line, state, options);
    allOutput.push(...lines);
  }

  if (!state.gotResult) {
    const interrupted: FeedEvent = {
      type: "interrupted",
      turns: state.turnCount,
      tools: state.toolCount,
    };
    allOutput.push(...renderFeedEvent(interrupted, options.verbose ?? false));
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
