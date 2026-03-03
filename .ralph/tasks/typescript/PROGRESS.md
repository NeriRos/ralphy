# Progress — typescript

## Section 1 — Nx Workspace Scaffolding

- [x] Initialize Nx workspace: create `nx.json`, root `package.json` (with `"workspaces": ["packages/*"]`, `"type": "module"`), `tsconfig.base.json`
- [x] Run `bun install` to generate `bun.lock`
- [x] Create `packages/ralph/package.json` with `"bin"` entry pointing to `src/index.ts`, dependencies (`chalk`, `zod`), dev dependencies (`typescript`, `@types/node`)
- [x] Create `packages/ralph/tsconfig.json` extending `../../tsconfig.base.json` with `"include": ["src"]`
- [x] Update root `.gitignore` to add `node_modules/`, `dist/`, `bun.lock`
- [x] Verify `bun install` succeeds and `bunx nx --version` works

## Section 2 — Types, Schemas, and Static Assets

- [ ] Create `packages/ralph/src/types.ts`: Zod schemas for `State`, `Usage`, `HistoryEntry`, plus `Phase`, `Engine`, `Mode` type aliases; export inferred types
- [ ] Copy `src/bin/prompts/*.md` to `packages/ralph/prompts/` (4 files)
- [ ] Copy `src/bin/templates/*.md` to `packages/ralph/templates/` (6 files)
- [ ] Create `packages/ralph/src/templates.ts`: `renderTemplate(content, vars)` using `String.replaceAll`, `resolvePromptPath(name)` and `resolveTemplatePath(name)` using `import.meta.dir`
- [ ] Write tests for `renderTemplate` and schema parsing in `packages/ralph/src/__tests__/types.test.ts`

## Section 3 — State Management and Progress Parsing

- [ ] Create `packages/ralph/src/state.ts`: `readState(taskDir)`, `writeState(taskDir, state)` (atomic write via tmp+rename), `updateState(taskDir, updater)`, `buildInitialState(opts)`, `migrateState(taskDir)`, `ensureState(taskDir)`
- [ ] Create `packages/ralph/src/progress.ts`: `extractCurrentSection(content)` (port AWK logic — find first section with unchecked items), `countProgress(content)` returning `{ checked, unchecked, total }`
- [ ] Write tests for state read/write round-trip, atomic write behavior, and progress parsing in `packages/ralph/src/__tests__/state.test.ts` and `packages/ralph/src/__tests__/progress.test.ts`

## Section 4 — Git Operations and Display

- [ ] Create `packages/ralph/src/git.ts`: `getCurrentBranch()`, `gitAdd(files)`, `gitCommit(message)`, `gitPush()` (with fallback chain: push, push with upstream, push with set-upstream), `commitState(taskDir, message)`
- [ ] Create `packages/ralph/src/display.ts`: `showBanner(state, opts)`, `showStatus(state, taskDir)`, `showList(tasksDir)` — port ANSI formatting using chalk
- [ ] Write tests for git helpers (mock execSync) and display output in `packages/ralph/src/__tests__/git.test.ts`

## Section 5 — Phase Transitions

- [ ] Create `packages/ralph/src/phases.ts`: `advancePhase(state, taskDir)` (research→plan→exec, with no-execute stop), `setPhase(state, taskDir, targetPhase)`, `autoTransitionAfterExec(state, taskDir)`, `autoTransitionAfterReview(state, taskDir)`, `recordPhaseTransition(state, from, to)`, `inferPhaseFromFiles(taskDir)`
- [ ] Implement the exec↔review loop logic: exec always → review; review → exec (if issues) or done (if clean)
- [ ] Write tests for phase transitions covering all state machine paths in `packages/ralph/src/__tests__/phases.test.ts`

## Section 6 — Stream Formatters

- [ ] Create `packages/ralph/src/formatters/claude-stream.ts`: line-by-line JSON parser for Claude `stream-json` output; handle event types (system, assistant, user, result); accumulate usage stats; ANSI output via chalk; support compact/verbose modes
- [ ] Create `packages/ralph/src/formatters/codex-stream.ts`: JSONL parser for Codex output; handle event types (thread.started, turn.started/completed, tool events, response events); rate limit detection (exit 42); stderr handling
- [ ] Write tests for both formatters with sample stream data in `packages/ralph/src/__tests__/formatters.test.ts`

## Section 7 — Engine Execution and CLI

- [ ] Create `packages/ralph/src/engine.ts`: `runEngine(opts)` that spawns `claude` or `codex` CLI via `Bun.spawn` / `child_process.spawn`, pipes prompt via stdin, streams stdout through the appropriate formatter; `handleEngineFailure(exitCode)` with exit code handling (42=rate limit, 130=interrupted, 137=killed)
- [ ] Create `packages/ralph/src/cli.ts`: `parseArgs(argv)` returning parsed options (mode, name, prompt, engine, model, maxIterations, flags); port the existing manual parser logic
- [ ] Write tests for CLI argument parsing in `packages/ralph/src/__tests__/cli.test.ts`

## Section 8 — Main Loop and Entry Point

- [ ] Create `packages/ralph/src/loop.ts`: main iteration loop porting the shell main loop — init/resume task, build prompt (read STEERING.md + phase prompt + template vars), run engine, handle transitions, check STOP signal, `shouldContinue()` logic
- [ ] Create `packages/ralph/src/index.ts`: entry point with `#!/usr/bin/env bun` shebang; wire `parseArgs` → mode routing (task/list/status/advance/set-phase) → loop or display
- [ ] Wire `buildTaskPrompt(state, taskDir)` — concatenate STEERING.md content + rendered phase prompt with all template variables
- [ ] Write integration test: parse args → build prompt → verify prompt content in `packages/ralph/src/__tests__/loop.test.ts`

## Section 9 — Build, Install, and End-to-End Verification

- [ ] Configure Nx build target in `packages/ralph/project.json` or `package.json` nx config; verify `bunx nx build ralph` produces output in `dist/`
- [ ] Update `Makefile` install target to build first (`bunx nx build ralph`), then copy `dist/` output to `.ralph/bin/`
- [ ] Add `"ralph"` script to root `package.json`: `"ralph": "bun packages/ralph/src/index.ts"`
- [ ] End-to-end smoke test: run `bun packages/ralph/src/index.ts list` and `bun packages/ralph/src/index.ts status --name typescript` against existing task state
- [ ] Verify existing `.ralph/tasks/typescript/state.json` loads and parses correctly through the new code
- [ ] Run full test suite: `bun test`
