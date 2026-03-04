# Plan: types-fix

> Eliminate duplicated types and ensure all shared types come from `@ralphy/types`.

## Approach

Two concrete duplication issues were found. Both are straightforward type extractions that don't change runtime behavior.

### Change 1: Extract `IterationUsageSchema` into `@ralphy/types`

Add a Zod schema for per-iteration usage stats (the 7 fields: `cost_usd`, `duration_ms`, `num_turns`, `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`) with required fields. Export the inferred type as `IterationUsage`.

Refactor `HistoryEntrySchema.usage` to reuse `IterationUsageSchema.partial().optional()` so the shape stays in one place.

Then replace `ClaudeUsageStats` in `@ralphy/engine` with an import of `IterationUsage` from `@ralphy/types`.

### Change 2: Use `Engine` type in `LoopOptions`

`apps/cli/src/loop.ts` already imports from `@ralphy/types` but has an inline `"claude" | "codex"` in `LoopOptions.engine`. Import `Engine` and use it. Fix the same inline cast in the test file.

## Files Modified

| File                                               | Change                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/types/src/types.ts`                      | Add `IterationUsageSchema` + `IterationUsage`, refactor `HistoryEntrySchema.usage` |
| `packages/engine/src/formatters/claude-stream.ts`  | Remove `ClaudeUsageStats`, import `IterationUsage`                                 |
| `packages/engine/src/engine.ts`                    | Update import from local → `@ralphy/types`                                         |
| `packages/engine/src/__tests__/formatters.test.ts` | Update import                                                                      |
| `apps/cli/src/loop.ts`                             | Add `Engine` to import, use in `LoopOptions`                                       |
| `apps/cli/src/__tests__/loop.test.ts`              | Replace inline cast with `Engine` type                                             |

## Risks

- **None significant.** Field names match exactly between `ClaudeUsageStats` and the schema. The only difference is required vs optional, and we keep `IterationUsage` with required fields (matching engine output) while `HistoryEntry.usage` stays partial/optional (matching serialized state).
- Renaming `ClaudeUsageStats` → `IterationUsage` is semantically better since Codex could also report usage.
