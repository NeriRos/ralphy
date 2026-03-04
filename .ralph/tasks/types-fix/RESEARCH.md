# Research: types-fix

> Task: Go over all files and ensure types are not duplicated and are used from the types lib.

## Summary of Findings

The `@ralphy/types` package (`packages/types/src/types.ts`) is the canonical location for shared types. Most packages import from it correctly. However, there are **two concrete duplication issues** and several types that could optionally be centralized.

---

## Issue 1: `LoopOptions.engine` duplicates `Engine` type

**File:** `apps/cli/src/loop.ts:17`

```ts
engine: "claude" | "codex";
```

This is an inline duplicate of `Engine` from `@ralphy/types` (line 19: `export type Engine = "claude" | "codex"`).

The file already imports `State` from `@ralphy/types` (line 2) but does not import `Engine`.

**Fix:** Import `Engine` from `@ralphy/types` and use it:

```ts
import type { State, Engine } from "@ralphy/types";
// ...
engine: Engine;
```

**Callsites:** `LoopOptions` is used in `loop.ts:mainLoop()` and constructed in the CLI entry point. The test file (`apps/cli/src/__tests__/loop.test.ts:149`) also has an inline cast `"codex" as "claude" | "codex"` that would benefit from using the `Engine` type.

---

## Issue 2: `ClaudeUsageStats` duplicates fields of `HistoryEntry.usage`

**File:** `packages/engine/src/formatters/claude-stream.ts:8-16`

```ts
export interface ClaudeUsageStats {
  cost_usd: number;
  duration_ms: number;
  num_turns: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}
```

**Compare with** `@ralphy/types` `HistoryEntrySchema.usage` (line 78-87):

```ts
usage: z.object({
  cost_usd: z.number().optional(),
  duration_ms: z.number().optional(),
  num_turns: z.number().optional(),
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
  cache_creation_input_tokens: z.number().optional(),
}).optional(),
```

These have **identical field names**. The difference: `ClaudeUsageStats` fields are required `number`, while the schema fields are `optional`. The `ClaudeUsageStats` type represents engine output (always present when stats exist), while the schema represents serialized state (optional for history entries without stats).

**Consumers of `ClaudeUsageStats`:**

- `packages/engine/src/engine.ts:3` — imports it, uses in `EngineResult.usage` (line 16) and local state (lines 104, 111)
- `packages/engine/src/formatters/claude-stream.ts` — defines and uses it throughout
- `packages/engine/src/__tests__/formatters.test.ts:5,22` — imports and uses it
- `apps/cli/src/loop.ts:175-234` — uses `EngineResult["usage"]` which is `ClaudeUsageStats | null`, maps fields into `HistoryEntry.usage` and `Usage` accumulators

**Fix options:**

1. **Extract a shared Zod schema** into `@ralphy/types` (e.g. `IterationUsageSchema` with required fields), derive `ClaudeUsageStats`-equivalent type from it. Make `HistoryEntrySchema.usage` reuse it with `.partial().optional()`.
2. **Simpler**: Define the type in `@ralphy/types` as `IterationUsage` and import it in the engine package. Keep `HistoryEntry.usage` using the optional version derived from the same schema.

---

## Types That Are Correctly Centralized

These types are already properly imported from `@ralphy/types`:

| Type                     | Defined in        | Imported by                                                                            |
| ------------------------ | ----------------- | -------------------------------------------------------------------------------------- |
| `State`                  | `types.ts:115`    | `core/state.ts`, `core/phases.ts`, `cli/loop.ts`, `cli/display.ts`, `cli/loop.test.ts` |
| `Engine`                 | `types.ts:19`     | `engine/engine.ts`, `cli/cli.ts`                                                       |
| `Mode`                   | `types.ts:20`     | `cli/cli.ts`                                                                           |
| `StorageProvider`        | `types.ts:5-14`   | `context/context.ts` (import + re-export)                                              |
| `PhaseConfig`            | `types.ts:51-54`  | `phases/phases.ts`                                                                     |
| `PhaseFrontmatterSchema` | `types.ts:38-47`  | `phases/phases.ts`                                                                     |
| `StateSchema`            | `types.ts:90-109` | `core/state.ts`                                                                        |

---

## Types That Are Package-Local (Correctly So)

These types are scoped to their package and don't need centralizing:

| Type                                        | File                       | Reason                                                           |
| ------------------------------------------- | -------------------------- | ---------------------------------------------------------------- |
| `BuildInitialStateOpts`                     | `core/state.ts:37-43`      | Only used within core/state and one test                         |
| `ProgressCount`                             | `core/progress.ts:1-5`     | Only used within core                                            |
| `Style`, `StyledText`                       | `output/output.ts:3-18`    | Only used within output package                                  |
| `RunEngineOptions`                          | `engine/engine.ts:6-12`    | Only used within engine package                                  |
| `EngineResult`                              | `engine/engine.ts:14-17`   | Used by engine + cli/loop.ts (cross-package but engine-specific) |
| `ClaudeStreamOptions`, `ClaudeStreamResult` | `claude-stream.ts`         | Internal to engine formatters                                    |
| `CodexStreamOptions`, `CodexStreamResult`   | `codex-stream.ts`          | Internal to engine formatters                                    |
| `ParsedArgs`                                | `cli/cli.ts:4-17`          | Only used within CLI app                                         |
| `ShowBannerOpts`                            | `cli/display.ts:7-15`      | Only used within CLI app                                         |
| `AppContext`                                | `context/context.ts:38-40` | Only used within context package                                 |

---

## Dependency Graph for Changes

```
@ralphy/types  (add IterationUsageSchema + IterationUsage type)
  ↓
@ralphy/engine (import IterationUsage, remove ClaudeUsageStats or alias it)
  ↓
apps/cli       (import Engine type for LoopOptions, fix test cast)
```

No circular dependencies. Changes flow downstream from `@ralphy/types`.

---

## Files to Modify

1. **`packages/types/src/types.ts`** — Add `IterationUsageSchema` and `IterationUsage` type. Optionally refactor `HistoryEntrySchema.usage` to reuse it.
2. **`packages/engine/src/formatters/claude-stream.ts`** — Replace `ClaudeUsageStats` with import from `@ralphy/types` (or alias).
3. **`packages/engine/src/engine.ts`** — Update import of usage stats type.
4. **`packages/engine/src/__tests__/formatters.test.ts`** — Update import.
5. **`apps/cli/src/loop.ts`** — Import `Engine` from `@ralphy/types`, use in `LoopOptions`.
6. **`apps/cli/src/__tests__/loop.test.ts`** — Replace inline `"claude" | "codex"` cast with `Engine` type.

---

## Edge Cases

- The `EngineResult.usage` field is typed as `ClaudeUsageStats | null`. If the Codex engine ever reports usage stats, this type name is misleading. Renaming to `IterationUsage` fixes this semantic issue too.
- `apps/cli/src/loop.ts:175-234` maps `ClaudeUsageStats` fields into `HistoryEntry.usage` — field names already match exactly, so the refactor won't change runtime behavior.
- The `UsageSchema` (aggregate totals in `State`) has different field names (`total_cost_usd` vs `cost_usd`) — this is intentional and distinct from per-iteration usage. No change needed.
