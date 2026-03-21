import { Link } from "react-router-dom";
import { useTasks } from "../hooks/useTasks";
import { PhaseBadge } from "../components/PhaseBadge";
import { useSidecar } from "../context/SidecarContext";

function formatCost(usd: number): string {
  return `$${(Math.round(usd * 100) / 100).toFixed(2)}`;
}

export function TaskListView() {
  const { connected } = useSidecar();
  const { tasks, loading } = useTasks();

  if (!connected) {
    return (
      <>
        <div className="header">
          <h1>Ralphy</h1>
        </div>
        <div className="container" style={{ textAlign: "center", paddingTop: 60 }}>
          <p style={{ color: "var(--text-dim)" }}>Connecting to sidecar...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="header">
        <h1>Ralphy</h1>
        <Link to="/tasks/new">
          <button className="primary">+ New Task</button>
        </Link>
      </div>
      <div className="container">
        {loading ? (
          <p style={{ color: "var(--text-dim)" }}>Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <p style={{ color: "var(--text-dim)", marginBottom: 12 }}>No tasks yet</p>
            <Link to="/tasks/new">
              <button className="primary">Create your first task</button>
            </Link>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-dim)" }}>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>Name</th>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>Phase</th>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>Progress</th>
                <th style={{ textAlign: "right", padding: "8px 12px" }}>Iterations</th>
                <th style={{ textAlign: "right", padding: "8px 12px" }}>Cost</th>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr
                  key={task.name}
                  style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                >
                  <td style={{ padding: "10px 12px" }}>
                    <Link to={`/tasks/${task.name}`} style={{ fontWeight: 600 }}>
                      {task.name}
                    </Link>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <PhaseBadge phase={task.phase} />
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {task.progress ? (
                      <ProgressBar checked={task.progress.checked} total={task.progress.total} />
                    ) : (
                      <span style={{ color: "var(--text-dim)" }}>--</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    {task.totalIterations}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    {formatCost(task.usage.total_cost_usd)}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <StatusBadge status={task.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function ProgressBar({ checked, total }: { checked: number; total: number }) {
  if (total === 0) return <span style={{ color: "var(--text-dim)" }}>--</span>;
  const pct = Math.round((checked / total) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 80,
          height: 6,
          background: "var(--border)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: pct === 100 ? "var(--success)" : "var(--accent)",
            borderRadius: 3,
          }}
        />
      </div>
      <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
        {checked}/{total}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "var(--accent)",
    completed: "var(--success)",
    blocked: "var(--warning)",
    failed: "var(--error)",
  };
  return (
    <span
      style={{
        color: colors[status] ?? "var(--text-dim)",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {status}
    </span>
  );
}
