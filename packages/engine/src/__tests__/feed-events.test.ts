import { describe, expect, test } from "bun:test";
import { renderFeedEvent } from "../feed-events";

// Strip ANSI escape codes for readable assertions
function strip(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("renderFeedEvent", () => {
  describe("session event", () => {
    test("renders session in non-verbose mode", () => {
      const lines = renderFeedEvent({
        type: "session",
        model: "claude-sonnet-4-20250514",
        sessionId: "abc12345",
      });
      const text = strip(lines.join("\n"));
      expect(text).toContain("claude-sonnet-4-20250514");
      expect(text).toContain("abc12345");
    });

    test("renders session in verbose mode with version and toolCount", () => {
      const lines = renderFeedEvent(
        {
          type: "session",
          model: "claude-sonnet-4-20250514",
          sessionId: "abc12345",
          version: "1.2.3",
          toolCount: 5,
        },
        true,
      );
      const text = strip(lines.join("\n"));
      expect(text).toContain("claude-sonnet-4-20250514");
      expect(text).toContain("abc12345");
      expect(text).toContain("v1.2.3");
      expect(text).toContain("tools: 5");
      expect(lines.length).toBe(3); // sep, info, sep
    });

    test("renders verbose session without version/toolCount", () => {
      const lines = renderFeedEvent(
        {
          type: "session",
          model: "claude-sonnet-4-20250514",
          sessionId: "abc12345",
        },
        true,
      );
      const text = strip(lines.join("\n"));
      expect(text).toContain("claude-sonnet-4-20250514");
      expect(lines.length).toBe(3);
    });
  });

  describe("session-unknown event", () => {
    test("renders session-unknown", () => {
      const lines = renderFeedEvent({ type: "session-unknown", sessionId: "xyz" });
      const text = strip(lines.join("\n"));
      expect(text).toContain("UNKNOWN");
      expect(text).toContain("xyz");
      expect(text).toContain("see --log");
    });
  });

  describe("agent event", () => {
    test("renders agent description", () => {
      const lines = renderFeedEvent({ type: "agent", description: "Building feature" });
      const text = strip(lines.join("\n"));
      expect(text).toContain("agent: Building feature");
    });
  });

  describe("thinking event", () => {
    test("renders thinking with preview in verbose mode", () => {
      const lines = renderFeedEvent(
        { type: "thinking", preview: "Line 1\nLine 2\nLine 3\nLine 4\nLine 5", totalLines: 5 },
        true,
      );
      const text = strip(lines.join("\n"));
      expect(text).toContain("thinking");
      expect(text).toContain("Line 1");
      expect(text).toContain("Line 2");
      expect(text).toContain("Line 3");
      expect(text).toContain("2 more lines");
    });

    test("renders thinking with preview <= 3 lines in verbose mode", () => {
      const lines = renderFeedEvent(
        { type: "thinking", preview: "Line 1\nLine 2\nLine 3", totalLines: 3 },
        true,
      );
      const text = strip(lines.join("\n"));
      expect(text).toContain("thinking");
      expect(text).not.toContain("more lines");
    });

    test("renders thinking with preview in non-verbose mode", () => {
      const lines = renderFeedEvent({ type: "thinking", preview: "First line\nSecond line" });
      const text = strip(lines.join("\n"));
      expect(text).toContain("First line");
      expect(lines.length).toBe(1);
    });

    test("renders thinking without preview", () => {
      const lines = renderFeedEvent({ type: "thinking" });
      const text = strip(lines.join("\n"));
      expect(text).toContain("💭");
      expect(lines.length).toBe(1);
    });
  });

  describe("text event", () => {
    test("renders text", () => {
      const lines = renderFeedEvent({ type: "text", text: "Hello world" });
      const text = strip(lines.join("\n"));
      expect(text).toContain("Hello world");
    });
  });

  describe("tool-start event", () => {
    test("renders tool-start with file summary", () => {
      const lines = renderFeedEvent({
        type: "tool-start",
        name: "Read",
        summary: { kind: "file", name: "foo.ts" },
      });
      const text = strip(lines.join("\n"));
      expect(text).toContain("Read");
      expect(text).toContain("foo.ts");
    });

    test("renders tool-start with command summary", () => {
      const lines = renderFeedEvent({
        type: "tool-start",
        name: "Bash",
        summary: { kind: "command", text: "ls -la" },
      });
      const text = strip(lines.join("\n"));
      expect(text).toContain("Bash");
      expect(text).toContain("$ ls -la");
    });

    test("renders tool-start with search summary (with path)", () => {
      const lines = renderFeedEvent({
        type: "tool-start",
        name: "Grep",
        summary: { kind: "search", pattern: "TODO", path: "src" },
      });
      const text = strip(lines.join("\n"));
      expect(text).toContain("TODO");
      expect(text).toContain("src");
    });

    test("renders tool-start with search summary (without path)", () => {
      const lines = renderFeedEvent({
        type: "tool-start",
        name: "Grep",
        summary: { kind: "search", pattern: "TODO" },
      });
      const text = strip(lines.join("\n"));
      expect(text).toContain("TODO");
    });

    test("renders tool-start with url summary", () => {
      const lines = renderFeedEvent({
        type: "tool-start",
        name: "WebFetch",
        summary: { kind: "url", url: "https://example.com" },
      });
      const text = strip(lines.join("\n"));
      expect(text).toContain("https://example.com");
    });

    test("renders tool-start with prompt summary", () => {
      const lines = renderFeedEvent({
        type: "tool-start",
        name: "Ask",
        summary: { kind: "prompt", text: "What do you think?" },
      });
      const text = strip(lines.join("\n"));
      expect(text).toContain("What do you think?");
    });

    test("renders tool-start with edit summary", () => {
      const lines = renderFeedEvent({
        type: "tool-start",
        name: "Edit",
        summary: { kind: "edit" },
      });
      const text = strip(lines.join("\n"));
      expect(text).toContain("edit");
    });

    test("renders tool-start with write summary", () => {
      const lines = renderFeedEvent({
        type: "tool-start",
        name: "Write",
        summary: { kind: "write" },
      });
      const text = strip(lines.join("\n"));
      expect(text).toContain("write");
    });

    test("renders tool-start with raw summary", () => {
      const lines = renderFeedEvent({
        type: "tool-start",
        name: "Custom",
        summary: { kind: "raw", text: "key=value" },
      });
      const text = strip(lines.join("\n"));
      expect(text).toContain("key=value");
    });

    test("renders tool-start without summary", () => {
      const lines = renderFeedEvent({ type: "tool-start", name: "Unknown" });
      const text = strip(lines.join("\n"));
      expect(text).toContain("Unknown");
    });
  });

  describe("tool-end event", () => {
    test("renders tool-end as empty", () => {
      const lines = renderFeedEvent({ type: "tool-end", name: "Read", summary: "200 lines" });
      expect(lines).toEqual([]);
    });

    test("renders tool-end without name as empty", () => {
      const lines = renderFeedEvent({ type: "tool-end" });
      expect(lines).toEqual([]);
    });
  });

  describe("tool-result-preview event", () => {
    test("renders preview lines", () => {
      const lines = renderFeedEvent({
        type: "tool-result-preview",
        lines: ["line 1", "line 2"],
      });
      const text = strip(lines.join("\n"));
      expect(text).toContain("line 1");
      expect(text).toContain("line 2");
    });

    test("renders preview lines with truncation", () => {
      const lines = renderFeedEvent({
        type: "tool-result-preview",
        lines: ["line 1"],
        truncated: 10,
      });
      const text = strip(lines.join("\n"));
      expect(text).toContain("line 1");
      expect(text).toContain("10 more lines");
    });
  });

  describe("turn-start event", () => {
    test("renders turn-start", () => {
      const lines = renderFeedEvent({ type: "turn-start" });
      const text = strip(lines.join("\n"));
      expect(text).toContain("turn started");
    });
  });

  describe("turn-done event", () => {
    test("renders turn-done with tokens", () => {
      const lines = renderFeedEvent({ type: "turn-done", inputTokens: 100, outputTokens: 200 });
      const text = strip(lines.join("\n"));
      expect(text).toContain("✓ done");
      expect(text).toContain("in=100");
      expect(text).toContain("out=200");
    });

    test("renders turn-done without tokens", () => {
      const lines = renderFeedEvent({ type: "turn-done" });
      const text = strip(lines.join("\n"));
      expect(text).toContain("✓ done");
    });
  });

  describe("result event", () => {
    test("renders result in non-verbose mode", () => {
      const lines = renderFeedEvent({
        type: "result",
        cost: 0.12,
        timeMs: 5000,
        turns: 3,
        inputTokens: 100,
        outputTokens: 200,
        cached: 50,
      });
      const text = strip(lines.join("\n"));
      expect(text).toContain("✓ done");
      expect(text).toContain("cost=$0.12");
      expect(text).toContain("time=5s");
      expect(text).toContain("turns=3");
      expect(text).toContain("in=100");
      expect(text).toContain("out=200");
      expect(text).toContain("cached=50");
    });

    test("renders result in verbose mode", () => {
      const lines = renderFeedEvent(
        {
          type: "result",
          cost: 0.12,
          timeMs: 5000,
          turns: 3,
          inputTokens: 100,
          outputTokens: 200,
          cached: 50,
        },
        true,
      );
      const text = strip(lines.join("\n"));
      expect(text).toContain("✓ Done");
      expect(text).toContain("cost=$0.12");
    });
  });

  describe("result-error event", () => {
    test("renders result-error", () => {
      const lines = renderFeedEvent({ type: "result-error", message: "something failed" });
      const text = strip(lines.join("\n"));
      expect(text).toContain("Error");
      expect(text).toContain("something failed");
    });
  });

  describe("error event", () => {
    test("renders error", () => {
      const lines = renderFeedEvent({ type: "error", message: "bad things" });
      const text = strip(lines.join("\n"));
      expect(text).toContain("error:");
      expect(text).toContain("bad things");
    });
  });

  describe("rate-limit event", () => {
    test("renders rate-limit", () => {
      const lines = renderFeedEvent({ type: "rate-limit", message: "rate limited" });
      const text = strip(lines.join("\n"));
      expect(text).toContain("Rate limit reached");
      expect(text).toContain("rate limited");
    });
  });

  describe("interrupted event", () => {
    test("renders interrupted in non-verbose mode", () => {
      const lines = renderFeedEvent({ type: "interrupted", turns: 3, tools: 5 });
      const text = strip(lines.join("\n"));
      expect(text).toContain("Stream interrupted");
      expect(lines.length).toBe(2);
    });

    test("renders interrupted in verbose mode", () => {
      const lines = renderFeedEvent({ type: "interrupted", turns: 3, tools: 5 }, true);
      const text = strip(lines.join("\n"));
      expect(text).toContain("Stream interrupted");
      expect(text).toContain("turns=3");
      expect(text).toContain("tools=5");
      expect(lines.length).toBe(4);
    });
  });

  describe("raw event", () => {
    test("renders raw text", () => {
      const lines = renderFeedEvent({ type: "raw", text: "some raw output" });
      expect(lines).toEqual(["some raw output"]);
    });
  });
});

// Exercise styled() with all style variants for transitive output.ts coverage
import { styled } from "@ralphy/output";

describe("styled (all style variants)", () => {
  test("warn style", () => {
    const result = styled("warning", "warn");
    expect(result).toContain("warning");
  });

  test("header style", () => {
    const result = styled("heading", "header");
    expect(result).toContain("heading");
  });
});
