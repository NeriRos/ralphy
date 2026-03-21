const PHASES = ["research", "plan", "exec", "review", "done"];

const PHASE_COLORS: Record<string, string> = {
  research: "var(--cyan)",
  plan: "var(--accent)",
  exec: "var(--warning)",
  review: "var(--success)",
  done: "var(--success)",
};

export function PhaseStepper({ currentPhase }: { currentPhase: string }) {
  const currentIdx = PHASES.indexOf(currentPhase);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "10px 20px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      {PHASES.map((phase, i) => {
        const isActive = phase === currentPhase;
        const isPast = i < currentIdx;
        const color = PHASE_COLORS[phase] ?? "var(--text-dim)";

        return (
          <div key={phase} style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 4,
                background: isActive ? `${color}22` : "transparent",
                border: isActive ? `1px solid ${color}` : "1px solid transparent",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: isPast || isActive ? color : "var(--border)",
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 400,
                  color: isPast || isActive ? color : "var(--text-dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {phase}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div
                style={{
                  width: 24,
                  height: 1,
                  background: isPast ? color : "var(--border)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
