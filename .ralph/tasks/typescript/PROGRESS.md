# Progress: Convert ralphy to TypeScript + Nx + Bun

## Section 1 — Nx Workspace Scaffolding

- [ ] Create `package.json` with `"type": "module"`, `"name": "ralphy"`, bin entry pointing to `dist/index.js`, and all dependencies (nx, @nx/js, typescript, commander, picocolors, zod, vitest)
- [ ] Create `nx.json` with `cli.packageManager: "bun"`, `tui.enabled: false`, and `@nx/js/typescript` plugin config
- [ ] Create `tsconfig.base.json` with strict mode, ESM module settings, and path aliases
- [ ] Create `tsconfig.json` extending base, with `include: ["src/**/*.ts"]`
- [ ] Create `project.json` with build (tsc), test (vitest), lint, and typecheck targets
- [ ] Create `vitest.config.ts` with basic configuration
- [ ] Run `bun install` and verify `bun nx build` compiles (with a placeholder `src/index.ts`)
- [ ] Copy `src/bin/prompts/*.md` to `assets/prompts/`, `src/bin/templates/*.md` to `assets/templates/`, `src/gitignore` to `assets/gitignore`

## Section 2 — Types and Schemas

- [ ] Create `src/types.ts`: Zod schemas for `StateJson` (version, name, prompt, phase, phaseIteration, totalIterations, createdAt, lastModified, engine, model, status, usage, history[], metadata), `Phase` enum (research, plan, exec, review, done), `Engine` type, `Model` type, `HistoryEntry`, `UsageStats`
- [ ] Create `src/core/state.ts`: `readState(taskDir)`, `writeState(taskDir, state)` (atomic write via temp+rename), `initState(taskDir, name, prompt, engine, model)`, `migrateState(state)`, `updateIteration(taskDir, phase, iteration)`, `commitState(taskDir, updates)`
- [ ] Create `src/core/phase.ts`: phase transition map (`PHASE_TRANSITIONS`), `advancePhase(state)`, `setPhase(state, targetPhase)`, `recordTransition(taskDir, from, to)`, `autoTransitionAfterExec(taskDir)`, `autoTransitionAfterReview(taskDir, hasIssues)`
- [ ] Verify types compile with `bun nx typecheck`

## Section 3 — Core Modules (Progress, Template)

- [ ] Create `src/core/progress.ts`: `countProgress(content)` returning `{total, checked, unchecked, issues}`, `extractCurrentSection(content, sectionNumber)` returning the markdown section text, `hasIssues(content)` checking for `⚠️` markers — port regex patterns exactly from loop.sh (`^\- \[x\]`, `^\- \[ \]`, `^## `, `⚠️`)
- [ ] Create `src/core/template.ts`: `renderTemplate(content, vars)` replacing `{{TASK_NAME}}`, `{{TASK_DIR}}`, `{{DATE}}`, `{{PHASE}}`, `{{PHASE_ITERATION}}`, `{{TASK_PROMPT}}`; `scaffoldTaskFiles(taskDir, taskName, prompt)` creating state.json, STEERING.md, and rendering prompt templates
- [ ] Create `src/utils/git.ts`: `getCurrentBranch()`, `gitPush(message?)`, `isGitRepo()` — use `child_process.execSync` or Bun shell
- [ ] Verify with `bun nx typecheck`

## Section 4 — CLI Argument Parsing and Display

- [ ] Create `src/cli/args.ts`: Use `commander` to define modes (task, list, status, advance, set-phase), options (--name, --prompt, --prompt-file, --claude [model], --codex, --no-execute, --delay, --log, --phase), and positional max-iterations arg. Export a parsed `Config` type.
- [ ] Create `src/display/terminal.ts`: `showBanner(taskName, phase, engine, model, iteration)`, `showStatus(state)`, `showList(tasksDir)` — use `picocolors` for ANSI colors. Port the banner format and status table from loop.sh.
- [ ] Wire `src/index.ts` to parse args and dispatch to list/status/advance/set-phase commands (task mode as stub for now)
- [ ] Verify `bun nx build` succeeds and `bun dist/index.ts --help` shows usage

## Section 5 — Engine Runner and Prompt Builder

- [ ] Create `src/engine/prompt.ts`: `buildTaskPrompt(taskDir, phase, phaseIteration, taskName, taskPrompt)` — reads prompt template from `assets/prompts/task_{phase}.md`, reads STEERING.md content, reads current PROGRESS.md section for exec/review phases, concatenates and renders template variables
- [ ] Create `src/engine/runner.ts`: `runEngine(config)` — spawns `claude` or `codex` CLI as child process with appropriate flags (`--print`, `--output-format stream-json` for claude; `exec --json` for codex), pipes prompt via stdin, captures stdout stream, returns exit code. Include `handleEngineFailure(exitCode)` with retry logic for rate limits (exit 42).
- [ ] Add asset resolution helper: function to resolve `assets/` path relative to the built entry point using `import.meta.dirname`

## Section 6 — Stream Formatters

- [ ] Create `src/formatters/claude.ts`: parse JSONL stream line by line, handle event types (`system/init`, `assistant/text`, `assistant/tool_use`, `assistant/thinking`, `user/tool_result`, `result`), output formatted text to stdout, accumulate usage stats, support verbose/compact modes and `--log` raw JSON logging
- [ ] Create `src/formatters/codex.ts`: parse codex JSONL stream, handle event types (`thread.started`, `turn.started/completed`, tool start/complete, text deltas, reasoning), detect rate limits (exit 42), output formatted text, support verbose/compact modes
- [ ] Integrate formatters into `engine/runner.ts` — pipe child process stdout through the appropriate formatter based on engine type

## Section 7 — Main Loop and Integration

- [ ] Wire up `src/index.ts` main loop for task mode: read/create state → show banner → check stop signal → build prompt → run engine with formatter → update state (iteration, usage) → check auto-transition → git push → loop or exit
- [ ] Implement stop signal detection: check for `TASK_DIR/STOP` file before each iteration
- [ ] Implement `advance` command: read state, call `advancePhase()`, commit state, print result
- [ ] Implement `set-phase` command: read state, call `setPhase()`, commit state, print result
- [ ] Verify full flow: `bun dist/index.js task --name test --prompt "test" --claude` starts and runs

## Section 8 — Install Mechanism and Cleanup

- [ ] Create `scripts/install.ts`: replaces Makefile — copies `dist/` and `assets/` to target `.ralph/` dir, creates tasks dir, adds `ralph` script to target package.json if present, preserves existing tasks
- [ ] Add `"install-ralph"` script to package.json running the install script
- [ ] Update `.gitignore` to include `dist/`, `node_modules/`, `bun.lock`
- [ ] Run `bun nx build` and verify `scripts/install.ts` works for self-installation into `.ralph/`

## Section 9 — Testing and Verification

- [ ] Write unit tests for `core/state.ts`: init, read, write, migrate, atomic writes
- [ ] Write unit tests for `core/phase.ts`: all transitions, edge cases (already done, invalid transitions)
- [ ] Write unit tests for `core/progress.ts`: counting checkboxes, extracting sections, detecting issues
- [ ] Write unit tests for `core/template.ts`: variable substitution, scaffolding
- [ ] Write unit tests for `cli/args.ts`: all modes, option combinations, defaults
- [ ] Run `bun nx affected -t test,lint,typecheck` and fix any failures
- [ ] End-to-end: create a task, advance through phases manually, verify state.json updates correctly
