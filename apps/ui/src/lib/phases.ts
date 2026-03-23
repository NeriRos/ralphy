export const PHASES = ["specify", "research", "plan", "exec", "review", "done"] as const;

export type PhaseName = (typeof PHASES)[number];

export const PHASE_COLORS: Record<PhaseName, string> = {
  specify: "magenta",
  research: "cyan",
  plan: "accent",
  exec: "warning",
  review: "success",
  done: "success",
};
