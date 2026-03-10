import { styled } from "@ralphy/output";

export type ToolInputSummary =
  | { kind: "file"; name: string }
  | { kind: "command"; text: string }
  | { kind: "search"; pattern: string; path?: string }
  | { kind: "url"; url: string }
  | { kind: "prompt"; text: string }
  | { kind: "edit" }
  | { kind: "write" }
  | { kind: "raw"; text: string };

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
  | { type: "tool-start"; name: string; summary?: ToolInputSummary }
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

function formatToolSummary(s: ToolInputSummary): string {
  switch (s.kind) {
    case "file":
      return `📄 ${s.name}`;
    case "command":
      return `$ ${s.text}`;
    case "search":
      return s.path ? `🔍 ${s.pattern} in ${s.path}` : `🔍 ${s.pattern}`;
    case "url":
      return `🌐 ${s.url}`;
    case "prompt":
      return `💬 ${s.text}`;
    case "edit":
      return "✏️  edit";
    case "write":
      return "📝 write";
    case "raw":
      return s.text;
  }
}

type EventOf<T extends FeedEvent["type"]> = Extract<FeedEvent, { type: T }>;
type FeedRenderer<T extends FeedEvent["type"]> = (e: EventOf<T>, verbose: boolean) => string[];

const feedRenderers: { [K in FeedEvent["type"]]: FeedRenderer<K> } = {
  session: (e, verbose) => {
    if (verbose) {
      const sep = styled("━".repeat(50), "gray");
      return [
        sep,
        `  ${styled("model:", "dim")} ${styled(e.model, "bold")}  ${styled(`session: ${e.sessionId}…  v${e.version ?? ""}  tools: ${e.toolCount ?? 0}`, "dim")}`,
        sep,
      ];
    }
    return [
      `${styled("──", "gray")} ${styled(e.model, "bold")} ${styled(`(${e.sessionId}…)`, "gray")}`,
    ];
  },

  "session-unknown": (e) => [
    `${styled("✗", "error")} ${styled("UNKNOWN", "bold")} ${styled(`(${e.sessionId}…) - see --log`, "dim")}`,
  ],

  agent: (e) => [`  ${styled(`⊳ agent: ${e.description}`, "dim")}`],

  thinking: (e, verbose) => {
    if (verbose && e.preview) {
      const lines = e.preview.split("\n");
      const out = [`\n  ${styled("💭 thinking", "gray")}`];
      for (const tl of lines.slice(0, 3)) {
        out.push(`  ${styled(tl, "gray")}`);
      }
      if ((e.totalLines ?? lines.length) > 3) {
        out.push(`  ${styled(`  … (${(e.totalLines ?? lines.length) - 3} more lines)`, "gray")}`);
      }
      return out;
    }
    if (e.preview) {
      const firstLine = e.preview.split("\n")[0] ?? "";
      return [`  ${styled("💭", "gray")} ${styled(firstLine, "dim")}`];
    }
    return [`  ${styled("💭", "gray")}`];
  },

  text: (e) => [`\n${styled(e.text, "bold")}`],

  "tool-start": (e) => {
    let line = `  ${styled("▶", "cyan")} ${styled(e.name, "cyan")}`;
    if (e.summary) line += ` ${styled(formatToolSummary(e.summary), "dim")}`;
    return [line];
  },

  "tool-end": (e) => {
    if (e.name && e.summary) {
      return [
        ` ${styled("✓", "success")} ${styled(e.name, "dim")} ${styled(`→ ${e.summary}`, "dim")}`,
      ];
    }
    if (e.name) {
      return [` ${styled("✓", "success")} ${styled(e.name, "dim")}`];
    }
    return [` ${styled("✓", "success")}`];
  },

  "tool-result-preview": (e) => {
    const out: string[] = [];
    for (const pl of e.lines) {
      out.push(`    ${styled(pl, "dim")}`);
    }
    if (e.truncated) {
      out.push(`    ${styled(`… (${e.truncated} more lines)`, "dim")}`);
    }
    return out;
  },

  "turn-start": () => [`\n${styled("▶ turn started", "bold")}`],

  "turn-done": (e) => {
    if (e.inputTokens !== undefined) {
      const info = `in=${e.inputTokens}  out=${e.outputTokens ?? 0}`;
      return [`\n${styled("✓ done", "success")}  ${styled(info, "dim")}`];
    }
    return [`\n${styled("✓ done", "success")}`];
  },

  result: (e, verbose) => {
    if (verbose) {
      const sep = styled("━".repeat(50), "gray");
      return [`\n${styled("✓ Done", "successBold")}  ${styled(resultInfo(e), "dim")}`, `${sep}\n`];
    }
    return [`\n${styled("✓ done", "success")}  ${styled(resultInfo(e), "dim")}`];
  },

  "result-error": (e) => [`\n${styled("✗ Error", "fail")} ${styled(e.message, "error")}`],

  error: (e) => [`${styled("error:", "error")} ${e.message}`],

  "rate-limit": (e) => [`${styled("✗ Rate limit reached", "fail")} ${styled(e.message, "error")}`],

  interrupted: (e, verbose) => {
    if (verbose) {
      const sep = styled("━".repeat(50), "gray");
      return [
        "",
        `${styled("✗ Stream interrupted", "fail")}  ${styled("(no result received — Claude may have hit usage limits or been interrupted)", "dim")}`,
        styled(`  turns=${e.turns}  tools=${e.tools}`, "dim"),
        sep,
      ];
    }
    return [
      "",
      `${styled("✗ Stream interrupted", "fail")}  ${styled("(no result received — Claude may have hit usage limits or been interrupted)", "dim")}`,
    ];
  },

  raw: (e) => [e.text],
};

/**
 * Render a FeedEvent to chalk-styled string lines.
 * Used for backward-compatible string output and tests.
 */
export function renderFeedEvent(event: FeedEvent, verbose = false): string[] {
  const render = feedRenderers[event.type] as FeedRenderer<typeof event.type>;
  return render(event, verbose);
}
