import { styled } from "@ralphy/output";

/**
 * Structured output events emitted by engine stream formatters.
 * Both Claude and Codex formatters produce these same event types,
 * enabling shared rendering logic (Ink components or chalk strings).
 */
export type FeedEvent =
  | { type: "session"; model: string; sessionId: string; version?: string; toolCount?: number }
  | { type: "session-unknown"; sessionId: string }
  | { type: "agent"; description: string }
  | { type: "thinking"; preview?: string; totalLines?: number }
  | { type: "text"; text: string }
  | { type: "tool-start"; name: string; summary: string }
  | { type: "tool-end"; name?: string; summary?: string }
  | { type: "tool-result-preview"; lines: string[]; truncated?: number }
  | { type: "turn-start" }
  | { type: "turn-done"; inputTokens?: number; outputTokens?: number }
  | {
      type: "result";
      cost: number;
      timeMs: number;
      turns: number;
      inputTokens: number;
      outputTokens: number;
      cached: number;
    }
  | { type: "result-error"; message: string }
  | { type: "error"; message: string }
  | { type: "rate-limit"; message: string }
  | { type: "interrupted"; turns: number; tools: number }
  | { type: "raw"; text: string };

function formatCost(usd: number): string {
  return (Math.round(usd * 100) / 100).toFixed(2);
}

function resultInfo(e: Extract<FeedEvent, { type: "result" }>): string {
  return [
    `cost=$${formatCost(e.cost)}`,
    `time=${Math.round((e.timeMs / 1000) * 10) / 10}s`,
    `turns=${e.turns}`,
    `in=${e.inputTokens}`,
    `out=${e.outputTokens}`,
    `cached=${e.cached}`,
  ].join("  ");
}

/**
 * Render a FeedEvent to chalk-styled string lines.
 * Used for backward-compatible string output and tests.
 */
export function renderFeedEvent(event: FeedEvent, verbose = false): string[] {
  switch (event.type) {
    case "session":
      if (verbose) {
        const sep = styled("━".repeat(50), "gray");
        return [
          sep,
          `  ${styled("model:", "dim")} ${styled(event.model, "bold")}  ${styled(`session: ${event.sessionId}…  v${event.version ?? ""}  tools: ${event.toolCount ?? 0}`, "dim")}`,
          sep,
        ];
      }
      return [
        `${styled("──", "gray")} ${styled(event.model, "bold")} ${styled(`(${event.sessionId}…)`, "gray")}`,
      ];

    case "session-unknown":
      return [
        `${styled("✗", "error")} ${styled("UNKNOWN", "bold")} ${styled(`(${event.sessionId}…) - see --log`, "dim")}`,
      ];

    case "agent":
      return [`  ${styled(`⊳ agent: ${event.description}`, "dim")}`];

    case "thinking":
      if (verbose && event.preview) {
        const lines = event.preview.split("\n");
        const out = [`\n  ${styled("💭 thinking", "gray")}`];
        for (const tl of lines.slice(0, 3)) {
          out.push(`  ${styled(tl, "gray")}`);
        }
        if ((event.totalLines ?? lines.length) > 3) {
          out.push(
            `  ${styled(`  … (${(event.totalLines ?? lines.length) - 3} more lines)`, "gray")}`,
          );
        }
        return out;
      }
      if (event.preview) {
        const firstLine = event.preview.split("\n")[0] ?? "";
        return [`  ${styled("💭", "gray")} ${styled(firstLine, "dim")}`];
      }
      return [`  ${styled("💭", "gray")}`];

    case "text":
      return [`\n${styled(event.text, "bold")}`];

    case "tool-start": {
      let line = `  ${styled("▶", "cyan")} ${styled(event.name, "cyan")}`;
      if (event.summary) line += ` ${styled(event.summary, "dim")}`;
      return [line];
    }

    case "tool-end":
      if (event.name && event.summary) {
        return [
          ` ${styled("✓", "success")} ${styled(event.name, "dim")} ${styled(`→ ${event.summary}`, "dim")}`,
        ];
      }
      if (event.name) {
        return [` ${styled("✓", "success")} ${styled(event.name, "dim")}`];
      }
      return [` ${styled("✓", "success")}`];

    case "tool-result-preview": {
      const out: string[] = [];
      for (const pl of event.lines) {
        out.push(`    ${styled(pl, "dim")}`);
      }
      if (event.truncated) {
        out.push(`    ${styled(`… (${event.truncated} more lines)`, "dim")}`);
      }
      return out;
    }

    case "turn-start":
      return [`\n${styled("▶ turn started", "bold")}`];

    case "turn-done": {
      if (event.inputTokens !== undefined) {
        const info = `in=${event.inputTokens}  out=${event.outputTokens ?? 0}`;
        return [`\n${styled("✓ done", "success")}  ${styled(info, "dim")}`];
      }
      return [`\n${styled("✓ done", "success")}`];
    }

    case "result":
      if (verbose) {
        const sep = styled("━".repeat(50), "gray");
        return [
          `\n${styled("✓ Done", "successBold")}  ${styled(resultInfo(event), "dim")}`,
          `${sep}\n`,
        ];
      }
      return [`\n${styled("✓ done", "success")}  ${styled(resultInfo(event), "dim")}`];

    case "result-error":
      return [`\n${styled("✗ Error", "fail")} ${styled(event.message, "error")}`];

    case "error":
      return [`${styled("error:", "error")} ${event.message}`];

    case "rate-limit":
      return [`${styled("✗ Rate limit reached", "fail")} ${styled(event.message, "error")}`];

    case "interrupted":
      if (verbose) {
        const sep = styled("━".repeat(50), "gray");
        return [
          "",
          `${styled("✗ Stream interrupted", "fail")}  ${styled("(no result received — Claude may have hit usage limits or been interrupted)", "dim")}`,
          styled(`  turns=${event.turns}  tools=${event.tools}`, "dim"),
          sep,
        ];
      }
      return [
        "",
        `${styled("✗ Stream interrupted", "fail")}  ${styled("(no result received — Claude may have hit usage limits or been interrupted)", "dim")}`,
      ];

    case "raw":
      return [event.text];
  }
}
