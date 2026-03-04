# Progress: types-fix

## Section 1 — Add IterationUsage to @ralphy/types and update engine package

- [x] In `packages/types/src/types.ts`: Add `IterationUsageSchema` (Zod object with 7 required number fields: `cost_usd`, `duration_ms`, `num_turns`, `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`). Export schema and inferred type `IterationUsage`.
- [x] In `packages/types/src/types.ts`: Refactor `HistoryEntrySchema.usage` to use `IterationUsageSchema.partial().optional()` instead of inline `z.object({...}).optional()`.
- [x] In `packages/engine/src/formatters/claude-stream.ts`: Remove the `ClaudeUsageStats` interface. Import `IterationUsage` from `@ralphy/types`. Replace all usages of `ClaudeUsageStats` with `IterationUsage`.
- [x] In `packages/engine/src/engine.ts`: Change import of `ClaudeUsageStats` from `./formatters/claude-stream` to import `IterationUsage` from `@ralphy/types`. Update `EngineResult.usage` type from `ClaudeUsageStats | null` to `IterationUsage | null`.
- [x] In `packages/engine/src/__tests__/formatters.test.ts`: Update import of `ClaudeUsageStats` → `IterationUsage` from `@ralphy/types`.

## Section 2 — Fix Engine type in CLI and verify

- [x] In `apps/cli/src/loop.ts`: Add `Engine` to the existing `@ralphy/types` import. Change `LoopOptions.engine` from `"claude" | "codex"` to `Engine`.
- [x] In `apps/cli/src/__tests__/loop.test.ts`: Import `Engine` from `@ralphy/types`. Replace inline `"codex" as "claude" | "codex"` cast with `as Engine`.
- [x] Run typecheck to verify zero errors.
- [x] Run tests for affected packages to verify no regressions.

## Section 3 — Static Analysis

- [x] **Lint** — run the project linter (see `CLAUDE.md` for command). Zero errors, zero warnings.
- [x] **Typecheck** — run the type checker. Zero errors.
- [x] **Build** — run a production build to catch anything lint/typecheck miss (import resolution, SSR issues, etc.).
- [x] **Format** — run the formatter. Zero errors.

## Section 4 — Tests

- [x] **Unit tests** — engine (45 pass), cli (48 pass). All affected packages green.
- [x] **Integration tests** _(if applicable)_ — N/A, changes are pure type refactoring with no API/DB/cross-module boundary changes.
- [x] **E2E tests** _(if applicable)_ — N/A, no user-facing flow changes.

## Section 5 — Deploy

- [x] **Check deployment status** — N/A: no web deployment (CLI-only monorepo). GitHub Actions CI passed on all commits (3/3 green).
- [x] **Read build logs on failure** — N/A: CI succeeded, no failures to investigate.
- [x] **Smoke test the deployed URL** — N/A: no deployed URL. CLI tool verified via unit tests and CI.

## Section 6 — Static Analysis

- [x] **Lint** — verified via CI (all 3 commits passed). `nx affected` shows no remaining tasks.
- [x] **Typecheck** — verified via CI. Zero errors.
- [x] **Build** — verified via CI. Production build passed.
- [x] **Format** — verified via CI. Zero errors.

## Section 7 — Tests

- [x] **Unit tests** — verified via CI. All affected packages green (engine: 45 pass, cli: 48 pass).
- [x] **Integration tests** _(if applicable)_ — N/A, pure type refactoring.
- [x] **E2E tests** _(if applicable)_ — N/A, no user-facing flow changes.
