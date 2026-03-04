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

- [ ] **Lint** — run the project linter (see `CLAUDE.md` for command). Zero errors, zero warnings.
- [ ] **Typecheck** — run the type checker. Zero errors.
- [ ] **Build** — run a production build to catch anything lint/typecheck miss (import resolution, SSR issues, etc.).
- [ ] **Format** — run the formatter. Zero errors.

## Section 4 — Tests

- [ ] **Unit tests** — run tests for affected libraries/modules. If tests don't exist for new code, create them.
- [ ] **Integration tests** _(if applicable)_ — run if your changes touch API routes, database queries, or cross-module boundaries.
- [ ] **E2E tests** _(if applicable)_ — run if your changes affect user-facing flows (see `CLAUDE.md` for e2e command).

## Section 5 — Deploy

- [ ] **Check deployment status** — use Vercel MCP or CI dashboard to confirm the deploy succeeded.
- [ ] **Read build logs on failure** — identify the error, fix locally, re-run static + test checklists, commit, push again.
- [ ] **Smoke test the deployed URL** — verify the deployed version loads and the affected feature works.

## Section 6 — Static Analysis

- [ ] **Lint** — run the project linter (see `CLAUDE.md` for command). Zero errors, zero warnings.
- [ ] **Typecheck** — run the type checker. Zero errors.
- [ ] **Build** — run a production build to catch anything lint/typecheck miss (import resolution, SSR issues, etc.).
- [ ] **Format** — run the formatter. Zero errors.

## Section 7 — Tests

- [ ] **Unit tests** — run tests for affected libraries/modules. If tests don't exist for new code, create them.
- [ ] **Integration tests** _(if applicable)_ — run if your changes touch API routes, database queries, or cross-module boundaries.
- [ ] **E2E tests** _(if applicable)_ — run if your changes affect user-facing flows (see `CLAUDE.md` for e2e command).
