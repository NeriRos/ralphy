import { z } from "zod";

// --- Storage ---

export interface StorageProvider {
  /** Read a key. Returns null if it does not exist. */
  read(path: string): string | null;
  /** Write a key. Creates parent directories (or equivalent) as needed. */
  write(path: string, content: string): void;
  /** Delete a key. No-op if it does not exist. */
  remove(path: string): void;
  /** List child keys / entries under a prefix. Returns empty array if prefix does not exist. */
  list(prefix: string): string[];
}

// --- Type aliases ---

export type Phase = string;
export type Engine = "claude" | "codex";
export type Mode = "task" | "list" | "status" | "advance" | "set-phase";

// --- Phase config types ---

export const ContextEntrySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("file"),
    file: z.string(),
    label: z.string(),
  }),
  z.object({
    type: z.literal("currentSection"),
    label: z.string(),
  }),
]);

export type ContextEntry = z.infer<typeof ContextEntrySchema>;

export const PhaseFrontmatterSchema = z.object({
  name: z.string(),
  order: z.number(),
  requires: z.array(z.string()).default([]),
  next: z.string().nullable().default(null),
  autoAdvance: z.enum(["allChecked"]).nullable().default(null),
  loopBack: z.string().nullable().default(null),
  terminal: z.boolean().default(false),
  context: z.array(ContextEntrySchema).default([]),
});

export type PhaseFrontmatter = z.infer<typeof PhaseFrontmatterSchema>;

export interface PhaseConfig extends PhaseFrontmatter {
  /** The markdown body (prompt content) after the frontmatter. */
  prompt: string;
}

// --- Zod schemas ---

export const UsageSchema = z.object({
  total_cost_usd: z.number().default(0),
  total_duration_ms: z.number().default(0),
  total_turns: z.number().default(0),
  total_input_tokens: z.number().default(0),
  total_output_tokens: z.number().default(0),
  total_cache_read_input_tokens: z.number().default(0),
  total_cache_creation_input_tokens: z.number().default(0),
});

export const HistoryEntrySchema = z.object({
  timestamp: z.string(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  phase: z.string(),
  iteration: z.number(),
  engine: z.string(),
  model: z.string(),
  result: z.string(),
  usage: z
    .object({
      cost_usd: z.number().optional(),
      duration_ms: z.number().optional(),
      num_turns: z.number().optional(),
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      cache_read_input_tokens: z.number().optional(),
      cache_creation_input_tokens: z.number().optional(),
    })
    .optional(),
});

export const StateSchema = z.object({
  version: z.string().default("1"),
  name: z.string(),
  prompt: z.string(),
  phase: z.string(),
  phaseIteration: z.number().default(0),
  totalIterations: z.number().default(0),
  createdAt: z.string(),
  lastModified: z.string(),
  engine: z.string().default("claude"),
  model: z.string().default("opus"),
  status: z.string().default("active"),
  usage: UsageSchema.default({}),
  history: z.array(HistoryEntrySchema).default([]),
  metadata: z
    .object({
      branch: z.string().optional(),
    })
    .default({}),
});

// --- Inferred types ---

export type Usage = z.infer<typeof UsageSchema>;
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;
export type State = z.infer<typeof StateSchema>;
