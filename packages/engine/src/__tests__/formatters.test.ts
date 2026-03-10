import { describe, expect, test } from "bun:test";
import { parseClaudeLine } from "../formatters/claude-stream";
import type { IterationUsage } from "@ralphy/types";
import type { FeedEvent } from "../feed-events";
import { processCodexLine, formatCodexStream } from "../formatters/codex-stream";

// Strip ANSI escape codes for readable assertions
function strip(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

// ─── Claude stream formatter ─────────────────────────────────────

describe("parseClaudeLine", () => {
  function makeState() {
    return {
      turnCount: 0,
      toolCount: 0,
      gotResult: false,
      usage: null as IterationUsage | null,
    };
  }

  function parse(
    json: string | object,
    state = makeState(),
  ): { events: FeedEvent[]; state: ReturnType<typeof makeState> } {
    const line = typeof json === "string" ? json : JSON.stringify(json);
    return { events: parseClaudeLine(line, state), state };
  }

  test("skips empty lines", () => {
    expect(parse("").events).toEqual([]);
    expect(parse("  ").events).toEqual([]);
  });

  test("skips invalid JSON", () => {
    expect(parse("not json").events).toEqual([]);
  });

  test("skips events without type", () => {
    expect(parse({ foo: "bar" }).events).toEqual([]);
  });

  test("handles system init event", () => {
    const { events } = parse({
      type: "system",
      subtype: "init",
      model: "claude-sonnet-4-20250514",
      session_id: "abcdefghijklmnop",
      tools: [1, 2, 3],
    });
    expect(events).toEqual([
      {
        type: "session",
        model: "claude-sonnet-4-20250514",
        sessionId: "abcdefgh",
        toolCount: 3,
      },
    ]);
  });

  test("handles system init event with version", () => {
    const { events } = parse({
      type: "system",
      subtype: "init",
      model: "claude-sonnet-4-20250514",
      session_id: "abcdefghijklmnop",
      claude_code_version: "1.2.3",
      tools: [1, 2, 3],
    });
    expect(events).toEqual([
      {
        type: "session",
        model: "claude-sonnet-4-20250514",
        sessionId: "abcdefgh",
        version: "1.2.3",
        toolCount: 3,
      },
    ]);
  });

  test("handles unknown model", () => {
    const { events } = parse({ type: "system", subtype: "init", session_id: "abc" });
    expect(events).toEqual([{ type: "session-unknown", sessionId: "abc" }]);
  });

  test("handles task_started", () => {
    const { events } = parse({
      type: "system",
      subtype: "task_started",
      description: "Build something",
    });
    expect(events).toEqual([{ type: "agent", description: "Build something" }]);
  });

  test("handles assistant text block", () => {
    const state = makeState();
    const { events } = parse(
      { type: "assistant", message: { content: [{ type: "text", text: "Hello world" }] } },
      state,
    );
    expect(events).toEqual([{ type: "text", text: "Hello world" }]);
    expect(state.turnCount).toBe(1);
  });

  test("handles assistant tool_use block", () => {
    const state = makeState();
    const { events } = parse(
      {
        type: "assistant",
        message: {
          content: [{ type: "tool_use", name: "Read", input: { file_path: "/foo/bar/baz.ts" } }],
        },
      },
      state,
    );
    expect(events).toEqual([
      { type: "tool-start", name: "Read", summary: { kind: "file", name: "baz.ts" } },
    ]);
    expect(state.toolCount).toBe(1);
  });

  test("handles tool_use with command input", () => {
    const { events } = parse({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", name: "Bash", input: { command: "ls -la\necho foo" } }],
      },
    });
    expect(events[0]).toEqual({
      type: "tool-start",
      name: "Bash",
      summary: { kind: "command", text: "ls -la" },
    });
  });

  test("handles tool_use with pattern input", () => {
    const { events } = parse({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", name: "Grep", input: { pattern: "TODO", path: "/src/app" } }],
      },
    });
    expect(events[0]).toEqual({
      type: "tool-start",
      name: "Grep",
      summary: { kind: "search", pattern: "TODO", path: "app" },
    });
  });

  test("handles thinking block with text", () => {
    const { events } = parse({
      type: "assistant",
      message: { content: [{ type: "thinking", thinking: "Let me think" }] },
    });
    expect(events).toEqual([{ type: "thinking", preview: "Let me think", totalLines: 1 }]);
  });

  test("handles thinking block with multiple lines", () => {
    const { events } = parse({
      type: "assistant",
      message: {
        content: [{ type: "thinking", thinking: "Line 1\nLine 2\nLine 3\nLine 4\nLine 5" }],
      },
    });
    expect(events).toEqual([
      { type: "thinking", preview: "Line 1\nLine 2\nLine 3", totalLines: 5 },
    ]);
  });

  test("handles empty thinking block", () => {
    const { events } = parse({
      type: "assistant",
      message: { content: [{ type: "thinking", thinking: "" }] },
    });
    expect(events).toEqual([{ type: "thinking" }]);
  });

  test("handles user tool_result event", () => {
    const { events } = parse({
      type: "user",
      message: { content: [{ type: "tool_result", content: "result text" }] },
    });
    expect(events[0]).toEqual({ type: "tool-end" });
    expect(events[1]).toMatchObject({ type: "tool-result-preview", lines: ["result text"] });
  });

  test("handles user tool_result with array content", () => {
    const { events } = parse({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            content: [
              { type: "text", text: "line one" },
              { type: "image", data: "..." },
              { type: "text", text: "line two" },
            ],
          },
        ],
      },
    });
    expect(events[0]).toEqual({ type: "tool-end" });
    const preview = events[1] as Extract<FeedEvent, { type: "tool-result-preview" }>;
    expect(preview.lines).toEqual(["line one", "line two"]);
  });

  test("handles result event (success)", () => {
    const state = makeState();
    const { events } = parse(
      {
        type: "result",
        subtype: "success",
        total_cost_usd: 0.1234,
        duration_ms: 5000,
        num_turns: 3,
        usage: {
          input_tokens: 100,
          output_tokens: 200,
          cache_read_input_tokens: 50,
          cache_creation_input_tokens: 25,
        },
      },
      state,
    );
    expect(events).toEqual([
      {
        type: "result",
        cost: 0.12,
        timeMs: 5000,
        turns: 3,
        inputTokens: 100,
        outputTokens: 200,
        cached: 50,
      },
    ]);
    expect(state.gotResult).toBe(true);
    expect(state.usage).not.toBeNull();
    expect(state.usage!.input_tokens).toBe(100);
  });

  test("handles result event (error)", () => {
    const state = makeState();
    const { events } = parse(
      { type: "result", subtype: "error", result: "something went wrong" },
      state,
    );
    expect(events).toEqual([{ type: "result-error", message: "something went wrong" }]);
    expect(state.gotResult).toBe(true);
  });

  test("multi-line stream produces correct events and state", () => {
    const state = makeState();
    const lines = [
      {
        type: "system",
        subtype: "init",
        model: "claude-sonnet-4-20250514",
        session_id: "abc12345678",
      },
      { type: "assistant", message: { content: [{ type: "text", text: "Working on it" }] } },
      {
        type: "result",
        subtype: "success",
        total_cost_usd: 0.05,
        duration_ms: 2000,
        num_turns: 1,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      },
    ];

    const allEvents: FeedEvent[] = [];
    for (const line of lines) {
      allEvents.push(...parseClaudeLine(JSON.stringify(line), state));
    }

    expect(allEvents.some((e) => e.type === "session")).toBe(true);
    expect(allEvents.some((e) => e.type === "text" && e.text === "Working on it")).toBe(true);
    expect(allEvents.some((e) => e.type === "result")).toBe(true);
    expect(state.gotResult).toBe(true);
    expect(state.turnCount).toBe(1);
  });

  test("tracks interrupted state when no result event", () => {
    const state = makeState();
    parseClaudeLine(
      JSON.stringify({
        type: "system",
        subtype: "init",
        model: "claude-sonnet-4-20250514",
        session_id: "abc",
      }),
      state,
    );
    expect(state.gotResult).toBe(false);
  });

  test("tracks turn and tool counts", () => {
    const state = makeState();
    parseClaudeLine(
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "/a.ts" } }] },
      }),
      state,
    );
    expect(state.turnCount).toBe(1);
    expect(state.toolCount).toBe(1);
  });
});

// ─── Codex stream formatter ─────────────────────────────────────

describe("processCodexLine", () => {
  function makeState() {
    return { printingText: false, rateLimited: false, pendingTools: 0 };
  }

  test("skips empty lines", () => {
    const state = makeState();
    expect(processCodexLine("", state)).toEqual([]);
  });

  test("handles non-JSON rate limit line", () => {
    const state = makeState();
    const lines = processCodexLine("You have hit your limit", state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("Rate limit");
    expect(state.rateLimited).toBe(true);
  });

  test("handles non-JSON important error", () => {
    const state = makeState();
    const lines = processCodexLine("thread main panicked at foo", state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("error:");
  });

  test("shows non-JSON line in verbose mode only", () => {
    const state = makeState();
    expect(processCodexLine("some random text", state)).toEqual([]);
    const verboseLines = processCodexLine("some random text", state, {
      verbose: true,
    });
    const text = strip(verboseLines.join("\n"));
    expect(text).toContain("some random text");
  });

  test("handles thread.started", () => {
    const state = makeState();
    const event = { type: "thread.started", thread_id: "abcdef12345" };
    const lines = processCodexLine(JSON.stringify(event), state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("codex");
    expect(text).toContain("abcdef12");
  });

  test("handles turn.started", () => {
    const state = makeState();
    const event = { type: "turn.started" };
    const lines = processCodexLine(JSON.stringify(event), state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("turn started");
  });

  test("handles turn.completed with usage", () => {
    const state = makeState();
    const event = {
      type: "turn.completed",
      usage: { input_tokens: 500, output_tokens: 200 },
    };
    const lines = processCodexLine(JSON.stringify(event), state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("✓ done");
    expect(text).toContain("in=500");
    expect(text).toContain("out=200");
  });

  test("handles turn.completed without usage", () => {
    const state = makeState();
    const event = { type: "turn.completed" };
    const lines = processCodexLine(JSON.stringify(event), state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("✓ done");
  });

  test("handles turn.failed", () => {
    const state = makeState();
    const event = {
      type: "turn.failed",
      error: { message: "something broke" },
    };
    const lines = processCodexLine(JSON.stringify(event), state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("✗ Error");
    expect(text).toContain("something broke");
  });

  test("handles error event with rate limit", () => {
    const state = makeState();
    const event = {
      type: "error",
      message: "You have hit your limit for today",
    };
    const lines = processCodexLine(JSON.stringify(event), state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("Rate limit");
    expect(state.rateLimited).toBe(true);
  });

  test("handles error event without rate limit", () => {
    const state = makeState();
    const event = { type: "error", message: "some error" };
    const lines = processCodexLine(JSON.stringify(event), state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("error:");
    expect(text).toContain("some error");
  });

  test("handles text delta events", () => {
    const state = makeState();
    const event = {
      type: "response.output_text.delta",
      delta: "Hello",
    };
    const lines = processCodexLine(JSON.stringify(event), state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("Hello");
    expect(state.printingText).toBe(true);
  });

  test("handles text done events", () => {
    const state = makeState();
    state.printingText = true;
    const event = {
      type: "response.output_text.done",
      text: "final text",
    };
    const lines = processCodexLine(JSON.stringify(event), state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("final text");
    expect(state.printingText).toBe(false);
  });

  test("handles thinking delta events", () => {
    const state = makeState();
    const event = {
      type: "thinking.delta",
      delta: "considering options",
    };
    const lines = processCodexLine(JSON.stringify(event), state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("💭");
    expect(text).toContain("considering options");
  });

  test("handles tool.started event", () => {
    const state = makeState();
    const event = {
      type: "tool.started",
      name: "shell",
      command: "ls -la",
    };
    const lines = processCodexLine(JSON.stringify(event), state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("shell");
    expect(text).toContain("ls -la");
    expect(state.pendingTools).toBe(1);
  });

  test("handles tool.started with command_execution fallback", () => {
    const state = makeState();
    const event = {
      type: "item.started",
      item: { type: "command_execution" },
    };
    const lines = processCodexLine(JSON.stringify(event), state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("shell");
    expect(state.pendingTools).toBe(1);
  });

  test("handles tool.completed with result summary", () => {
    const state = makeState();
    state.pendingTools = 1;
    const event = {
      type: "tool.completed",
      name: "Read",
      output: "file contents here",
    };
    const lines = processCodexLine(JSON.stringify(event), state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("✓");
    expect(text).toContain("Read");
    expect(text).toContain("file contents here");
    expect(state.pendingTools).toBe(0);
  });

  test("handles item.added with tool", () => {
    const state = makeState();
    const event = {
      type: "item.added",
      item: { type: "tool_call", name: "Write" },
    };
    const lines = processCodexLine(JSON.stringify(event), state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("Write");
    expect(state.pendingTools).toBe(1);
  });

  test("handles item.added with message text", () => {
    const state = makeState();
    const event = {
      type: "item.added",
      item: { type: "agent_message", text: "Agent says hi" },
    };
    const lines = processCodexLine(JSON.stringify(event), state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("Agent says hi");
  });

  test("handles response.completed with output text", () => {
    const state = makeState();
    const event = {
      type: "response.completed",
      response: {
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "Done!" }],
          },
        ],
      },
    };
    const lines = processCodexLine(JSON.stringify(event), state);
    const text = strip(lines.join("\n"));
    expect(text).toContain("Done!");
  });

  test("shows unknown events in verbose mode", () => {
    const state = makeState();
    const event = { type: "custom.event", data: "xyz" };
    expect(processCodexLine(JSON.stringify(event), state)).toEqual([]);
    const verboseLines = processCodexLine(JSON.stringify(event), state, {
      verbose: true,
    });
    const text = strip(verboseLines.join("\n"));
    expect(text).toContain("custom.event");
  });
});

describe("formatCodexStream", () => {
  test("processes multi-line stream", () => {
    const stream = [
      JSON.stringify({ type: "thread.started", thread_id: "abc123456" }),
      JSON.stringify({ type: "turn.started" }),
      JSON.stringify({
        type: "response.output_text.delta",
        delta: "Working...",
      }),
      JSON.stringify({
        type: "turn.completed",
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    ].join("\n");

    const { output, result } = formatCodexStream(stream);
    const text = strip(output);
    expect(text).toContain("codex");
    expect(text).toContain("Working...");
    expect(text).toContain("✓ done");
    expect(result.rateLimited).toBe(false);
  });

  test("detects rate limiting", () => {
    const stream = [
      JSON.stringify({ type: "thread.started", thread_id: "abc123456" }),
      JSON.stringify({
        type: "error",
        message: "You have hit your limit",
      }),
    ].join("\n");

    const { result } = formatCodexStream(stream);
    expect(result.rateLimited).toBe(true);
  });

  test("handles rate limit in non-JSON line", () => {
    const stream = [
      JSON.stringify({ type: "thread.started", thread_id: "abc" }),
      "You have hit your limit for today",
    ].join("\n");

    const { result } = formatCodexStream(stream);
    expect(result.rateLimited).toBe(true);
  });
});
