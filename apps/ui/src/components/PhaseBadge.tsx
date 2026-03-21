const PHASE_COLORS: Record<string, string> = {
  research: "var(--cyan)",
  plan: "var(--accent)",
  exec: "var(--warning)",
  review: "var(--success)",
  done: "var(--success)",
};

export function PhaseBadge({ phase }: { phase: string }) {
  const color = PHASE_COLORS[phase] ?? "var(--text-dim)";
  return (
    <span
      style={{
        color,
        fontSize: 12,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        padding: "2px 8px",
        border: `1px solid ${color}`,
        borderRadius: 4,
      }}
    >
      {phase}
    </span>
  );
}
