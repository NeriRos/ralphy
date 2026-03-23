import { PHASE_COLORS, type PhaseName } from "../lib/phases";

export function PhaseBadge({ phase }: { phase: string }) {
  const raw = PHASE_COLORS[phase as PhaseName];
  const color = raw ? `var(--${raw})` : "var(--text-dim)";
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
