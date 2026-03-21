import type { State } from "@ralphy/types";

interface ProgressCount {
  checked: number;
  unchecked: number;
  total: number;
}

interface StatusBarProps {
  state: State;
  progress: ProgressCount | null;
  isRunning: boolean;
  stopReason: string | null;
}

function formatCost(usd: number): string {
  return `$${(Math.round(usd * 100) / 100).toFixed(2)}`;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function StatusBar({ state, progress, isRunning, stopReason }: StatusBarProps) {
  const pct =
    progress && progress.total > 0 ? Math.round((progress.checked / progress.total) * 100) : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "8px 20px",
        borderBottom: "1px solid var(--border)",
        fontSize: 12,
        color: "var(--text-dim)",
        background: isRunning ? "var(--bg-surface)" : "transparent",
      }}
    >
      <span>
        <strong style={{ color: "var(--text)" }}>Phase:</strong> {state.phase}
        {state.phaseIteration > 0 && ` (iter ${state.phaseIteration})`}
      </span>

      <span>
        <strong style={{ color: "var(--text)" }}>Total:</strong> {state.totalIterations} iterations
      </span>

      {pct !== null && (
        <span>
          <strong style={{ color: "var(--text)" }}>Progress:</strong> {progress!.checked}/
          {progress!.total} ({pct}%)
        </span>
      )}

      <span>
        <strong style={{ color: "var(--text)" }}>Cost:</strong>{" "}
        {formatCost(state.usage.total_cost_usd)}
      </span>

      <span>
        <strong style={{ color: "var(--text)" }}>Time:</strong>{" "}
        {formatDuration(state.usage.total_duration_ms)}
      </span>

      <span>
        <strong style={{ color: "var(--text)" }}>Engine:</strong> {state.engine}/{state.model}
      </span>

      {isRunning && <span style={{ color: "var(--success)", fontWeight: 600 }}>● RUNNING</span>}

      {stopReason && <span style={{ color: "var(--warning)" }}>Stopped: {stopReason}</span>}
    </div>
  );
}
