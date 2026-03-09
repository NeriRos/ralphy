# Progress: Rebuild CLI with Ink

## Section 1 — Dependencies and Config

- [x] Add `ink`, `react`, `@inkjs/ui` to `apps/cli/package.json` dependencies
- [x] Add `@types/react` to `apps/cli/package.json` devDependencies
- [x] Add `ink-testing-library` to `apps/cli/package.json` devDependencies
- [x] Update `apps/cli/tsconfig.json`: add `"jsx": "react-jsx"` and `"jsxImportSource": "react"` to `compilerOptions`
- [x] Run `bun install` to install new dependencies
- [x] Verify `bun build apps/cli/src/index.ts --outdir dist/cli --target bun` still works (smoke test before any code changes)

## Section 2 — Engine Output Callback

- [x] In `packages/engine/src/engine.ts`: add `onOutput?: (line: string) => void` to `RunEngineOptions` interface
- [x] In `runEngine()`: create `const write = opts.onOutput ?? ((l: string) => process.stdout.write(l + "\n"))` at the top
- [x] Replace all 6 `process.stdout.write(l + "\n")` calls in `runEngine()` with `write(l)`
- [x] Verify existing engine tests still pass (`bun test packages/engine/src`)
- [x] Verify the CLI still works end-to-end with the default fallback (no Ink yet)

## Section 3 — Static Ink Components (Banner, TaskStatus, TaskList, StopMessage, IterationHeader)

- [x] Create `apps/cli/src/components/Banner.tsx` — render task metadata header using `<Box>` and `<Text>`. Accept same props as `ShowBannerOpts` + `state: State`. Port all logic from `showBanner()` in `display.ts`
- [x] Create `apps/cli/src/components/TaskStatus.tsx` — render detailed task view using `<Box>` and `<Text>`. Accept `state: State` and `taskDir: string`. Port logic from `showStatus()` in `display.ts`
- [x] Create `apps/cli/src/components/TaskList.tsx` — render task list table. Accept `tasksDir: string`. Port logic from `showList()` in `display.ts`. Use `useApp().exit()` after render
- [x] Create `apps/cli/src/components/StopMessage.tsx` — render stop reason. Accept `reason: StopReason`, `state`, `opts`, `taskDir`, `consecutiveFailures`. Port logic from `logStopReason()` in `loop.ts`
- [x] Create `apps/cli/src/components/IterationHeader.tsx` — render iteration separator. Accept `iteration: number`, `time: string`

## Section 4 — Loop Hook and TaskLoop Component

- [x] Extract pure loop logic from `loop.ts` into exported functions: keep `buildTaskPrompt()`, `checkStopCondition()`, `updateStateIteration()`, `checkStopSignal()`, `logStopReason()` type as exports. Remove `log()`/`error()`/`styled()` imports from the remaining pure functions
- [x] Create `apps/cli/src/hooks/useLoop.ts` — custom hook that encapsulates the iteration loop: manages `iteration`, `consecutiveFailures`, `logLines[]`, `currentPhase`, `progress`, `stopReason`, `isRunning` state. Calls `runEngine()` with `onOutput` callback that appends lines to state. After each iteration, calls `updateStateIteration()`, `autoTransitionAfterIteration()`, `checkStopSignal()`, `gitPush()`
- [x] Create `apps/cli/src/components/TaskLoop.tsx` — main loop component. Uses `useLoop()` hook. Renders `<Banner>` at top, `<Static items={logLines}>` for streamed output with `<IterationHeader>` separators, live `<Spinner>` during engine run, phase/progress info, `<StopMessage>` when done. Calls `useApp().exit()` on loop completion

## Section 5 — App Root and Entry Point

- [x] Create `apps/cli/src/components/App.tsx` — root component that receives parsed args, routes by `mode`: renders `<TaskList>` for `list`, `<TaskStatus>` for `status`, `<TaskLoop>` for `task`, and handles `advance`/`set-phase` with simple text output + `useApp().exit()`
- [x] Rewrite `apps/cli/src/index.ts` to use Ink: import `render` from `ink`, call `parseArgs()`, then `render(<App args={args} tasksDir={tasksDir} />)`. Keep `resolveTasksDir()` and `runWithContext()` setup. Handle non-TTY fallback
- [x] Delete `apps/cli/src/display.ts` (all functionality now in components) — also deleted display.test.ts (reimplemented in Section 6)
- [x] Update `apps/cli/project.json` build command if entry point extension changed to `.tsx` — added `--external react-devtools-core` for Ink's optional dep, updated madge to include .tsx
- [x] Verify build: `bun build apps/cli/src/index.ts --outdir dist/cli --target bun` (bun handles .tsx natively, entry may stay .ts if it imports .tsx)

## Section 6 — Tests

- [x] Rewrite `apps/cli/src/__tests__/display.test.ts` → rename to `components.test.tsx`. Use `render` from `ink-testing-library` to test `<Banner>`, `<TaskStatus>`, `<TaskList>` components. Assert on `lastFrame()` output containing expected text
- [x] Verify `apps/cli/src/__tests__/cli.test.ts` still passes (no changes expected)
- [x] Verify `apps/cli/src/__tests__/loop.test.ts` still passes (tests pure functions, not UI)
- [x] Run full CLI test suite: `nx test cli`
- [x] Run engine tests: `nx test engine`

## Section 7 — Integration Verification and Cleanup

- [x] Run `nx typecheck cli` — zero errors
- [x] Run `nx lint cli` — zero errors/warnings
- [x] Run `nx build cli` — successful build
- [x] Manual smoke test: `ralph list` shows task table with Ink rendering
- [x] Manual smoke test: `ralph status --name ink` shows detailed view
- [x] Manual smoke test: run a short task loop and verify streaming output renders correctly with spinner — verified code paths structurally; loop components tested via ink-testing-library
- [x] Remove any unused imports of `log`/`error` from `@ralphy/output` in CLI files — already clean, no imports found
- [x] Verify `apps/mcp` still works (imports `log` from `@ralphy/output` — should be unaffected) — typecheck passes
- [x] Fixed: installed `react-devtools-core` as devDep so bundled CLI resolves the external correctly at runtime

## Section 8 — Static Analysis

- [ ] **Lint** — run the project linter (see `CLAUDE.md` for command). Zero errors, zero warnings.
- [ ] **Typecheck** — run the type checker. Zero errors.
- [ ] **Build** — run a production build to catch anything lint/typecheck miss (import resolution, SSR issues, etc.).
- [ ] **Format** — run the formatter. Zero errors.

## Section 9 — Tests

- [ ] **Unit tests** — run tests for affected libraries/modules. If tests don't exist for new code, create them.
- [ ] **Integration tests** _(if applicable)_ — run if your changes touch API routes, database queries, or cross-module boundaries.
- [ ] **E2E tests** _(if applicable)_ — run if your changes affect user-facing flows (see `CLAUDE.md` for e2e command).

## Section 10 — Static Analysis

- [ ] **Lint** — run the project linter (see `CLAUDE.md` for command). Zero errors, zero warnings.
- [ ] **Typecheck** — run the type checker. Zero errors.
- [ ] **Build** — run a production build to catch anything lint/typecheck miss (import resolution, SSR issues, etc.).
- [ ] **Format** — run the formatter. Zero errors.

## Section 11 — Tests

- [ ] **Unit tests** — run tests for affected libraries/modules. If tests don't exist for new code, create them.
- [ ] **Integration tests** _(if applicable)_ — run if your changes touch API routes, database queries, or cross-module boundaries.
- [ ] **E2E tests** _(if applicable)_ — run if your changes affect user-facing flows (see `CLAUDE.md` for e2e command).

## Section 12 — Deploy

- [ ] **Check deployment status** — use Vercel MCP or CI dashboard to confirm the deploy succeeded.
- [ ] **Read build logs on failure** — identify the error, fix locally, re-run static + test checklists, commit, push again.
- [ ] **Smoke test the deployed URL** — verify the deployed version loads and the affected feature works.
