import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useSidecar } from "../context/SidecarContext";
import { useTaskStream } from "../hooks/useTaskStream";
import { useDocument } from "../hooks/useDocument";
import { FeedLine } from "../components/FeedLine";
import { StatusBar } from "../components/StatusBar";
import { ProgressList } from "../components/ProgressList";
import { SteeringInput } from "../components/SteeringInput";
import type { State } from "@ralphy/types";

export function TaskDetailView() {
  const { name } = useParams<{ name: string }>();
  const { baseUrl } = useSidecar();
  const {
    state: streamState,
    logEntries,
    progress,
    progressItems,
    isRunning,
    stopReason,
    startTask,
    stopTask,
    addLogEntry,
  } = useTaskStream(name);

  // Fetch initial state if not streaming
  const [initialState, setInitialState] = useState<State | null>(null);
  useEffect(() => {
    if (!name || !baseUrl) return;
    fetch(`${baseUrl}/tasks/${name}`)
      .then((r) => r.json())
      .then(setInitialState)
      .catch(() => {});
  }, [name, baseUrl]);

  const state = streamState ?? initialState;

  // Use WS running state once known, otherwise fall back to HTTP-fetched isRunning
  const effectiveIsRunning =
    isRunning !== null
      ? isRunning
      : (initialState as Record<string, unknown> | null)?.isRunning === true;

  // Document editors
  const steering = useDocument(name, "STEERING.md");
  const plan = useDocument(name, "PLAN.md");
  const spec = useDocument(name, "spec.md");
  const research = useDocument(name, "RESEARCH.md");

  // Right panel accordion — always visible, one doc expanded
  const log = useDocument(name, "LOG.jsonl");

  type DocKey = "spec" | "plan" | "research" | "progress" | "steering" | "log";
  const [expandedDoc, setExpandedDoc] = useState<DocKey>("spec");

  // Refresh log content when tab is expanded or periodically while running
  useEffect(() => {
    if (expandedDoc !== "log") return;
    log.refresh();
    if (!effectiveIsRunning) return;
    const interval = setInterval(() => log.refresh(), 3000);
    return () => clearInterval(interval);
  }, [expandedDoc, effectiveIsRunning, log.refresh]);

  // Auto-scroll feed
  const feedRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [logEntries, autoScroll]);

  const handleScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  // Start options
  const [maxIterations, setMaxIterations] = useState("10");
  const [maxCost, setMaxCost] = useState("0");

  // Send steering message: appends to STEERING.md and resumes the session with new guidance
  const handleSendSteering = useCallback(
    async (message: string) => {
      if (!name || !baseUrl) return;
      // Call the steer endpoint which appends to STEERING.md and resumes the session
      await fetch(`${baseUrl}/tasks/${name}/steer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      // Update local state so the steering panel stays in sync
      steering.refresh();
      addLogEntry("steering", message);
    },
    [name, baseUrl, steering, addLogEntry],
  );

  if (!name) return null;

  return (
    <>
      <div className="header">
        <h1>
          <Link to="/" style={{ color: "var(--text-dim)" }}>
            Ralphy
          </Link>
          {" / "}
          {name}
          {state && (
            <span style={{ marginLeft: 12, fontSize: 13, color: "var(--text-dim)" }}>
              {state.status}
            </span>
          )}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          {effectiveIsRunning ? (
            <button className="danger" onClick={stopTask}>
              Stop
            </button>
          ) : state?.status !== "completed" ? (
            <button
              className="primary"
              onClick={() =>
                startTask({
                  engine: state?.engine ?? "claude",
                  model: state?.model ?? "sonnet",
                  prompt: state?.prompt ?? "",
                  maxIterations: Number(maxIterations) || 0,
                  maxCostUsd: Number(maxCost) || 0,
                })
              }
            >
              {state?.iteration ? "Resume" : "Start"}
            </button>
          ) : null}
        </div>
      </div>

      {state && (
        <StatusBar
          state={state}
          progress={progress}
          isRunning={effectiveIsRunning}
          stopReason={stopReason}
        />
      )}

      {!effectiveIsRunning && !stopReason && state?.status !== "completed" && (
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <label style={{ color: "var(--text-dim)", fontSize: 12 }}>
            Max iterations:
            <input
              type="number"
              value={maxIterations}
              onChange={(e) => setMaxIterations(e.target.value)}
              style={{ width: 60, marginLeft: 6, padding: "4px 8px" }}
            />
          </label>
          <label style={{ color: "var(--text-dim)", fontSize: 12 }}>
            Max cost ($):
            <input
              type="number"
              value={maxCost}
              onChange={(e) => setMaxCost(e.target.value)}
              style={{ width: 60, marginLeft: 6, padding: "4px 8px" }}
              step="0.5"
            />
          </label>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div
            ref={feedRef}
            onScroll={handleScroll}
            style={{
              flex: 1,
              overflow: "auto",
              padding: "12px 20px",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: 1.7,
            }}
          >
            {logEntries.length === 0 && !effectiveIsRunning ? (
              <p style={{ color: "var(--text-dim)", textAlign: "center", paddingTop: 40 }}>
                {state?.status === "completed"
                  ? "Task completed."
                  : state?.iteration
                    ? `${state.iteration} iterations completed. Click Resume to continue.`
                    : "Click Start to begin the task loop."}
              </p>
            ) : (
              logEntries.map((entry) => <FeedLine key={entry.id} entry={entry} />)
            )}

            {stopReason && (
              <div
                style={{
                  marginTop: 12,
                  padding: "8px 12px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  color: "var(--warning)",
                }}
              >
                Loop stopped: {stopReason}
              </div>
            )}
          </div>

          <SteeringInput onSend={handleSendSteering} disabled={!effectiveIsRunning} />
        </div>

        <div
          style={{
            width: 360,
            borderLeft: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Documents in fixed order — expanded one stays in place */}
          <DocPanel
            title="SPEC"
            expanded={expandedDoc === "spec"}
            content={spec.content}
            loading={spec.loading}
            placeholder="Feature specification — requirements, user stories, and success criteria."
            onExpand={() => setExpandedDoc("spec")}
          />

          <DocPanel
            title="RESEARCH"
            expanded={expandedDoc === "research"}
            content={research.content}
            loading={research.loading}
            placeholder="Research notes — codebase analysis and technical findings."
            onExpand={() => setExpandedDoc("research")}
          />

          <DocPanel
            title="PLAN"
            expanded={expandedDoc === "plan"}
            content={plan.content}
            loading={plan.loading}
            placeholder="Implementation plan — step-by-step tasks and architecture decisions."
            onExpand={() => setExpandedDoc("plan")}
          />

          {expandedDoc === "progress" ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={panelHeaderStyle}>PROGRESS</div>
              <ProgressList items={progressItems} />
            </div>
          ) : (
            <div
              onClick={() => setExpandedDoc("progress")}
              style={{
                padding: "8px 12px",
                borderTop: "1px solid var(--border)",
                background: "var(--bg-surface)",
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
                color: "var(--text-dim)",
              }}
            >
              PROGRESS
            </div>
          )}

          <DocPanel
            title="STEERING"
            expanded={expandedDoc === "steering"}
            content={steering.content}
            loading={steering.loading}
            placeholder="Live guidance for the task. Use the input below to steer the running loop."
            onExpand={() => setExpandedDoc("steering")}
          />

          <DocPanel
            title="LOG"
            expanded={expandedDoc === "log"}
            content={log.content}
            loading={log.loading}
            placeholder="Iteration log — raw output from each loop iteration."
            onExpand={() => setExpandedDoc("log")}
          />
        </div>
      </div>
    </>
  );
}

const panelHeaderStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid var(--border)",
  background: "var(--bg-surface)",
  fontWeight: 600,
  fontSize: 12,
};

function DocPanel({
  title,
  expanded,
  content,
  loading,
  placeholder,
  onExpand,
}: {
  title: string;
  expanded: boolean;
  content: string | null;
  loading: boolean;
  placeholder: string;
  onExpand: () => void;
}) {
  if (!expanded) {
    return (
      <div
        onClick={onExpand}
        style={{
          padding: "8px 12px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-surface)",
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer",
          color: "var(--text-dim)",
        }}
      >
        {title}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={panelHeaderStyle}>{title}</div>
      {loading ? (
        <div style={{ padding: 12, color: "var(--text-dim)", fontSize: 12 }}>Loading...</div>
      ) : content && content.trim().length > 0 ? (
        <div
          style={{
            overflow: "auto",
            flex: 1,
            padding: "8px 12px",
            fontSize: 12,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {content}
        </div>
      ) : (
        <div style={{ padding: 12, color: "var(--text-dim)", fontSize: 12 }}>{placeholder}</div>
      )}
    </div>
  );
}
