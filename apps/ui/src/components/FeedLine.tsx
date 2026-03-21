import type { FeedEvent, ToolInputSummary } from "@ralphy/types";
import type { LogEntry } from "../hooks/useTaskStream";

function formatToolSummary(s: ToolInputSummary): string {
  switch (s.kind) {
    case "file":
      return s.name;
    case "command":
      return `$ ${s.text}`;
    case "search":
      return s.path ? `${s.pattern} in ${s.path}` : s.pattern;
    case "url":
      return s.url;
    case "prompt":
      return s.text;
    case "edit":
      return "edit";
    case "write":
      return "write";
    case "raw":
      return s.text;
  }
}

function renderEvent(event: FeedEvent) {
  switch (event.type) {
    case "session":
      return (
        <div
          style={{
            color: "var(--text-dim)",
            borderBottom: "1px solid var(--border)",
            padding: "4px 0",
            margin: "8px 0",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--text)" }}>{event.model}</span>
          <span style={{ marginLeft: 8 }}>session: {event.sessionId}</span>
        </div>
      );

    case "thinking":
      return (
        <div style={{ color: "var(--text-dim)" }}>
          <span style={{ marginRight: 6 }}>💭</span>
          {event.preview?.split("\n")[0] ?? "thinking..."}
        </div>
      );

    case "text":
      return <div style={{ fontWeight: 600, margin: "4px 0" }}>{event.text}</div>;

    case "tool-start":
      return (
        <div>
          <span style={{ color: "var(--cyan)", marginRight: 6 }}>▶</span>
          <span style={{ color: "var(--cyan)" }}>{event.name}</span>
          {event.summary && (
            <span style={{ color: "var(--text-dim)", marginLeft: 8 }}>
              {formatToolSummary(event.summary)}
            </span>
          )}
        </div>
      );

    case "tool-end":
      return (
        <div>
          <span style={{ color: "var(--success)", marginRight: 6 }}>✓</span>
          {event.name && <span style={{ color: "var(--text-dim)" }}>{event.name}</span>}
          {event.summary && (
            <span style={{ color: "var(--text-dim)", marginLeft: 8 }}>→ {event.summary}</span>
          )}
        </div>
      );

    case "tool-result-preview":
      return (
        <div style={{ paddingLeft: 20, color: "var(--text-dim)" }}>
          {event.lines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
          {event.truncated && <div>… ({event.truncated} more lines)</div>}
        </div>
      );

    case "result": {
      const info = `cost=$${(Math.round(event.cost * 100) / 100).toFixed(2)}  time=${Math.round((event.timeMs / 1000) * 10) / 10}s  turns=${event.turns}`;
      return (
        <div style={{ color: "var(--success)", margin: "8px 0" }}>
          ✓ Done <span style={{ color: "var(--text-dim)" }}>{info}</span>
        </div>
      );
    }

    case "result-error":
      return <div style={{ color: "var(--error)" }}>✗ Error: {event.message}</div>;

    case "error":
      return <div style={{ color: "var(--error)" }}>error: {event.message}</div>;

    case "rate-limit":
      return <div style={{ color: "var(--error)" }}>✗ Rate limit: {event.message}</div>;

    case "turn-start":
      return <div style={{ color: "var(--text-dim)", margin: "4px 0" }}>▶ turn started</div>;

    case "turn-done":
      return (
        <div style={{ color: "var(--success)", margin: "4px 0" }}>
          ✓ done
          {event.inputTokens !== undefined && (
            <span style={{ color: "var(--text-dim)", marginLeft: 8 }}>
              in={event.inputTokens} out={event.outputTokens ?? 0}
            </span>
          )}
        </div>
      );

    case "interrupted":
      return <div style={{ color: "var(--error)" }}>✗ Stream interrupted (no result received)</div>;

    default:
      return null;
  }
}

export function FeedLine({ entry }: { entry: LogEntry }) {
  if (entry.kind === "info") {
    return <div style={{ color: "var(--text-muted)", padding: "2px 0" }}>{entry.text}</div>;
  }

  if (entry.kind === "feed" && entry.event) {
    return renderEvent(entry.event);
  }

  return null;
}
