# Progress: smoke-test

## Section 1 — Implementation

- [x] Create `packages/core/src/format.ts` with `formatTaskName` function
- [x] Add `"./format": "./src/format.ts"` export to `packages/core/package.json`
- [x] Create `packages/core/src/__tests__/format.test.ts` with test cases
- [x] Update `buildInitialState` in `packages/core/src/state.ts` to use `formatTaskName`

## Section 2 — Verification

- [x] Run `bun test` in `packages/core` and confirm all tests pass
- [x] Run `bunx tsc --noEmit` in `packages/core` to confirm compilation

## Section 3 — Deploy

- [ ] **Check deployment status** — use Vercel MCP or CI dashboard to confirm the deploy succeeded.
- [ ] **Read build logs on failure** — identify the error, fix locally, re-run static + test checklists, commit, push again.
- [ ] **Smoke test the deployed URL** — verify the deployed version loads and the affected feature works.

## Section 4 — Static Analysis

- [ ] **Lint** — run the project linter (see `CLAUDE.md` for command). Zero errors, zero warnings.
- [ ] **Typecheck** — run the type checker. Zero errors.
- [ ] **Build** — run a production build to catch anything lint/typecheck miss (import resolution, SSR issues, etc.).
- [ ] **Format** — run the formatter. Zero errors.

## Section 5 — Tests

- [ ] **Unit tests** — run tests for affected libraries/modules. If tests don't exist for new code, create them.
- [ ] **Integration tests** _(if applicable)_ — run if your changes touch API routes, database queries, or cross-module boundaries.
- [ ] **E2E tests** _(if applicable)_ — run if your changes affect user-facing flows (see `CLAUDE.md` for e2e command).
