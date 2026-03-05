# Progress — smoke-test

## Section 1 — Implement and verify

- [x] Create `packages/core/src/smoke.ts` with exported function `smokeTestPassed(): boolean` returning `true`
- [x] Create `packages/core/src/__tests__/smoke.test.ts` — describe block with one test asserting `smokeTestPassed() === true`, using `bun:test` imports
- [x] Add `"./smoke": "./src/smoke.ts"` to `packages/core/package.json` exports
- [x] Run `bunx nx test core` and confirm all tests pass

## Section 2 — Static Analysis

- [ ] **Lint** — run the project linter (see `CLAUDE.md` for command). Zero errors, zero warnings.
- [ ] **Typecheck** — run the type checker. Zero errors.
- [ ] **Build** — run a production build to catch anything lint/typecheck miss (import resolution, SSR issues, etc.).
- [ ] **Format** — run the formatter. Zero errors.

## Section 3 — Tests

- [ ] **Unit tests** — run tests for affected libraries/modules. If tests don't exist for new code, create them.
- [ ] **Integration tests** _(if applicable)_ — run if your changes touch API routes, database queries, or cross-module boundaries.
- [ ] **E2E tests** _(if applicable)_ — run if your changes affect user-facing flows (see `CLAUDE.md` for e2e command).

## Section 4 — Deploy

- [ ] **Check deployment status** — use Vercel MCP or CI dashboard to confirm the deploy succeeded.
- [ ] **Read build logs on failure** — identify the error, fix locally, re-run static + test checklists, commit, push again.
- [ ] **Smoke test the deployed URL** — verify the deployed version loads and the affected feature works.

## Section 5 — Static Analysis

- [ ] **Lint** — run the project linter (see `CLAUDE.md` for command). Zero errors, zero warnings.
- [ ] **Typecheck** — run the type checker. Zero errors.
- [ ] **Build** — run a production build to catch anything lint/typecheck miss (import resolution, SSR issues, etc.).
- [ ] **Format** — run the formatter. Zero errors.

## Section 6 — Tests

- [ ] **Unit tests** — run tests for affected libraries/modules. If tests don't exist for new code, create them.
- [ ] **Integration tests** _(if applicable)_ — run if your changes touch API routes, database queries, or cross-module boundaries.
- [ ] **E2E tests** _(if applicable)_ — run if your changes affect user-facing flows (see `CLAUDE.md` for e2e command).
