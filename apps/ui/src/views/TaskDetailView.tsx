import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useSidecar } from "../context/SidecarContext";
import { useTaskStream } from "../hooks/useTaskStream";
import { useDocument } from "../hooks/useDocument";
import { PhaseBadge } from "../components/PhaseBadge";
import { PhaseStepper } from "../components/PhaseStepper";
import { FeedLine } from "../components/FeedLine";
import { StatusBar } from "../components/StatusBar";
import { DocumentEditor } from "../components/DocumentEditor";
import type { State } from "@ralphy/types";

export function TaskDetailView() {
  const { name } = useParams<{ name: string }>();
  const { baseUrl } = useSidecar();
  const {
    state: streamState,
    logEntries,
    progress,
    isRunning,
    stopReason,
    startTask,
    stopTask,
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

  // STEERING.md editor
  const steering = useDocument(name, "STEERING.md");
  const [showSteering, setShowSteering] = useState(false);

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
            <span style={{ marginLeft: 12 }}>
              <PhaseBadge phase={state.phase} />
            </span>
          )}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowSteering(!showSteering)}>
            {showSteering ? "Hide Steering" : "Steering"}
          </button>
          {isRunning ? (
            <button className="danger" onClick={stopTask}>
              Stop
            </button>
          ) : (
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
              Start
            </button>
          )}
        </div>
      </div>

      {state && <PhaseStepper currentPhase={state.phase} />}

      {state && (
        <StatusBar
          state={state}
          progress={progress}
          isRunning={isRunning}
          stopReason={stopReason}
        />
      )}

      {!isRunning && !stopReason && (
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
          {logEntries.length === 0 && !isRunning ? (
            <p style={{ color: "var(--text-dim)", textAlign: "center", paddingTop: 40 }}>
              {state?.totalIterations
                ? `${state.totalIterations} iterations completed. Click Start to continue.`
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

        {showSteering && (
          <div
            style={{
              width: 360,
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <DocumentEditor
              title="STEERING.md"
              content={steering.content}
              loading={steering.loading}
              onSave={steering.save}
            />
          </div>
        )}
      </div>
    </>
  );
}
