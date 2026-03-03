# Research: Convert ralphy to TypeScript + Nx + Bun

## Task
Convert the ralphy project from a shell-based system into a TypeScript Node.js project using Nx as the build system and Bun as the package manager/runtime.

---

## Current Project Structure

```
ralphy/
├── Makefile                          # Build/install tool
├── skills-lock.json                  # Agent skill lock file
├── src/
│   ├── gitignore                     # Template .gitignore for installations
│   ├── bin/
│   │   ├── loop.sh                   # Main orchestrator (~1052 lines)
│   │   ├── formatters/
│   │   │   ├── format-claude-stream.sh  (~253 lines)
│   │   │   └── format-codex-stream.sh   (~403 lines)
│   │   ├── prompts/
│   │   │   ├── task_research.md
│   │   │   ├── task_plan.md
│   │   │   ├── task_exec.md
│   │   │   └── task_review.md
│   │   └── templates/
│   │       ├── PLAN.md
│   │       ├── PROGRESS.md
│   │       ├── STEERING.md
│   │       ├── checklist_deploy.md
│   │       ├── checklist_static.md
│   │       ├── checklist_tests.md
│   │       └── do_list.md
│   └── tasks/
│       └── .gitkeep
├── dist/                             # Empty build output
├── .ralph/                           # Self-installed copy (for dogfooding)
│   ├── bin/                          # Mirror of src/bin/ (gitignored)
│   └── tasks/typescript/             # This active task
└── .claude/
    ├── settings.local.json
    └── skills/ (agent-browser symlink)
```

### Key Insight: Source vs Installed
- `src/bin/` is the **source of truth** — edited during development
- `.ralph/bin/` is the **installed copy** — deployed to target projects via `make install`
- The `.ralph/` directory at project root is ralphy installed into itself (dogfooding)

---

## Files to Convert

### 1. `src/bin/loop.sh` — Main Orchestrator (1052 lines)

**Current functionality:**
- Argument parsing (modes: task, list, status, advance, set-phase)
- Engine configuration (claude/codex, model selection)
- Task validation and creation
- Template rendering with `sed`/`awk` ({{TASK_NAME}}, {{DATE}}, etc.)
- State management via `state.json` (init, migrate, update, detect phase)
- Phase transitions (research → plan → exec ↔ review → done)
- Progress tracking (parsing PROGRESS.md for `[x]`/`[ ]` checkboxes and `⚠️` markers)
- Prompt building (steering injection, phase-specific prompt assembly, checklist injection)
- Engine execution (piping prompts to `claude`/`codex` CLI, streaming through formatters)
- Auto-transitions after exec/review phases
- Git push after each iteration
- Stop signal detection
- Banner display with ANSI colors
- Usage stats accumulation

**External dependencies:**
- `jq` — JSON manipulation (heavily used for state.json read/write)
- `git` — branch detection, commit, push
- `claude` CLI — Claude Code execution
- `codex` CLI — Codex execution
- `sed`, `awk`, `grep`, `mktemp`, `date` — text processing

**Key patterns:**
- Atomic JSON updates: `jq ... file > file.tmp && mv file.tmp file`
- Shell functions defined in-file (no external modules)
- ANSI color codes for terminal output
- Heredoc-style prompt building (concatenating markdown files)

### 2. `src/bin/formatters/format-claude-stream.sh` (253 lines)

**Functionality:**
- Parses Claude `--output-format stream-json` JSONL line by line
- Handles event types: `system/init`, `assistant` (text, tool_use, thinking), `user` (tool results), `result`
- Verbose/compact output modes
- Raw JSON logging (`--log`, `--log-dir`)
- **Accumulates usage stats into `state.json`** via `update_state_usage()` — this is critical for cost tracking
- Exits 130 if stream interrupted (no result event)

**Dependencies:** `jq`, `bash`

### 3. `src/bin/formatters/format-codex-stream.sh` (403 lines)

**Functionality:**
- Parses `codex exec --json` JSONL
- Handles codex-specific event types: `thread.started`, `turn.*`, tool start/complete, text deltas, reasoning
- Rate limit detection (exits 42)
- Complex tool name/input/result extraction from deeply nested JSON structures
- Verbose/compact output modes

**Dependencies:** `jq`, `bash`

### 4. `Makefile`

**Functionality:**
- `make install [path]` — copies `src/bin/` to `<path>/.ralph/bin/`, creates tasks dir
- Adds `ralph` script to `package.json` if present
- Preserves existing tasks directory

### 5. Static Files (prompts, templates)
- `src/bin/prompts/*.md` — 4 markdown prompt templates with `{{PLACEHOLDER}}` variables
- `src/bin/templates/*.md` — 7 markdown templates (PLAN, PROGRESS, STEERING, checklists)
- `src/gitignore` — Template .gitignore for installations
- `skills-lock.json` — Agent skill configuration

These files are **not code** — they should be bundled as-is (assets/resources).

---

## Architecture Decisions

### Nx + Bun Configuration

**Latest setup (2026):**
- Nx 21.x with `--preset=ts` uses **npm/bun workspaces + TypeScript project references**
- Bun support since Nx 19.5: `"cli": { "packageManager": "bun" }` in `nx.json`
- Auto-detection via `bun.lock` / `bun.lockb` at root
- Use `@nx/js/typescript` plugin for build/typecheck targets

**Known gotchas:**
- Bun doesn't support Node.js IPC — may break `nx-cloud` and default task runner
- Nx TUI may not display output correctly with Bun — disable: `"tui": { "enabled": false }`
- Avoid `@nx/webpack:webpack` with `generatePackageJson: true` — use tsc instead
- Use Bun as **package manager** but `@nx/js:node` as runtime executor (safer)

### Project Structure (Target)

Since ralphy is a **single CLI tool** (not a monorepo with multiple packages), the Nx structure should be minimal:

```
ralphy/
├── nx.json
├── package.json              # root, "type": "module"
├── tsconfig.base.json
├── tsconfig.json
├── bun.lock
├── src/
│   ├── index.ts              # CLI entry point
│   ├── cli/
│   │   └── args.ts           # Argument parsing
│   ├── core/
│   │   ├── state.ts          # State management (state.json read/write)
│   │   ├── phase.ts          # Phase transitions
│   │   ├── progress.ts       # PROGRESS.md parsing
│   │   └── template.ts       # Template rendering
│   ├── engine/
│   │   ├── runner.ts         # Engine execution (claude/codex)
│   │   └── prompt.ts         # Prompt building
│   ├── formatters/
│   │   ├── claude.ts         # Claude stream formatter
│   │   └── codex.ts          # Codex stream formatter
│   ├── display/
│   │   └── terminal.ts       # Banner, status, list display
│   └── utils/
│       └── git.ts            # Git helpers
├── assets/
│   ├── prompts/              # Markdown prompt templates (copied from src/bin/prompts)
│   ├── templates/            # Markdown templates (copied from src/bin/templates)
│   └── gitignore             # Template .gitignore
├── project.json              # Nx project config
├── tsconfig.lib.json
└── tests/
    └── ...
```

### Module Breakdown from loop.sh

The 1052-line loop.sh naturally decomposes into these TypeScript modules:

| Shell Function(s) | TypeScript Module | Responsibility |
|---|---|---|
| `parse_args()` | `cli/args.ts` | CLI argument parsing (use a library like `commander` or `citty`) |
| `validate_task_mode()`, `validate_named_mode()`, `validate_set_phase_mode()` | `cli/args.ts` | Validation logic |
| `render_template()`, `scaffold_task_files()` | `core/template.ts` | `{{VAR}}` substitution, file scaffolding |
| `extract_current_section()`, `count_progress()` | `core/progress.ts` | PROGRESS.md parsing |
| `init_state()`, `ensure_state()`, `migrate_state()`, `update_state_json()`, `update_state_iteration()`, `detect_phase()`, `build_state_json()`, `commit_state()` | `core/state.ts` | state.json CRUD (use native JSON, not jq) |
| `advance_phase()`, `set_phase()`, `record_phase_transition()`, `auto_transition_after_exec()`, `auto_transition_after_review()` | `core/phase.ts` | Phase state machine |
| `build_task_prompt()` | `engine/prompt.ts` | Prompt assembly from templates + sections |
| `run_engine()`, `handle_engine_failure()` | `engine/runner.ts` | Subprocess execution of claude/codex CLI |
| `show_banner()`, `show_status()`, `show_list()` | `display/terminal.ts` | Terminal output with ANSI codes (use `chalk` or `picocolors`) |
| `git_push()` | `utils/git.ts` | Git operations |
| `check_stop_signal()`, `should_continue()` | Main loop logic in `index.ts` | Loop control |

### Formatter Conversion

The formatters (`format-claude-stream.sh`, `format-codex-stream.sh`) parse JSONL line by line. In TypeScript:
- Use Node.js `readline` or Bun's line reader on stdin
- Parse each line with `JSON.parse()` instead of `jq`
- All the nested field extraction (`jq -r '.item?.raw_item?.name? // ...'`) becomes simple optional chaining (`event?.item?.raw_item?.name ?? ...`)
- ANSI codes can use `picocolors` or `chalk`
- The `update_state_usage()` function writes to `state.json` — replace `jq` with `fs.readFileSync` + `JSON.parse` + `fs.writeFileSync`

### Install Mechanism

The Makefile `install` target copies `src/bin/` to a target `.ralph/`. In TypeScript:
- Build produces a bundled dist (or uses `tsc` to compile to `dist/`)
- Install script copies `dist/` (compiled JS) + `assets/` (prompts, templates) to `.ralph/`
- Could be an Nx target or a simple `bin` script in package.json
- The CLI entry point should use `import.meta.dirname` or `__dirname` to find assets relative to itself

---

## Dependencies to Add

| Package | Purpose |
|---|---|
| `typescript` | Language |
| `@nx/js` | Nx JavaScript/TypeScript plugin |
| `nx` | Build system |
| `picocolors` | ANSI terminal colors (tiny, fast) |
| `commander` or `citty` | CLI argument parsing |
| `zod` | Schema validation for state.json |
| `vitest` | Testing |

**Not needed:**
- `jq` — replaced by native JSON
- `sed`/`awk` — replaced by string methods
- `grep` — replaced by regex

---

## Constraints & Risks

1. **Backward compatibility**: Existing `.ralph/` installations in other projects use the shell scripts. The TypeScript version should either:
   - Ship a compiled JS bundle that runs with `node` (or `bun`)
   - Or provide a shim script that runs `bun dist/index.js`

2. **Asset bundling**: Prompts and templates are markdown files referenced at runtime. They need to be:
   - Bundled alongside compiled JS
   - Found via `import.meta.dirname` or similar

3. **Subprocess piping**: The formatters currently receive piped JSONL from claude/codex. In TypeScript, this becomes:
   - Spawn child process for `claude`/`codex`
   - Pipe stdout through formatter logic in-process (no separate process needed)
   - Or keep formatters as separate scripts and pipe through them

4. **Atomic file writes**: `jq ... > tmp && mv tmp file` pattern → use `fs.writeFileSync` with `{flag: 'w'}` or write to temp then rename

5. **Self-installation**: ralphy is installed into itself (`.ralph/`) for dogfooding. The build process needs to handle this correctly.

6. **`nx affected`**: The exec prompt mandates `nx affected -t test,lint,typecheck`. Since ralphy itself will now be an Nx project, this becomes available naturally.

---

## Ordering Constraints

1. **First**: Set up Nx workspace, package.json, tsconfig, nx.json
2. **Second**: Create type definitions (Zod schemas for state.json, phase types, etc.)
3. **Third**: Port core modules (state, progress, template, phase) — no external deps
4. **Fourth**: Port CLI arg parsing, display, and git helpers
5. **Fifth**: Port engine runner and prompt builder
6. **Sixth**: Port formatters (claude, codex)
7. **Seventh**: Wire up main loop (`index.ts`) connecting all modules
8. **Eighth**: Create install mechanism (replace Makefile)
9. **Last**: Tests, linting config, verify with `nx affected -t test,lint,typecheck`

---

## Existing Patterns to Follow

- State.json schema is well-defined — create a Zod schema from the existing structure
- Phase state machine is clearly documented in comments — encode as a TypeScript enum + transition map
- Template variables are a fixed set: `{{TASK_NAME}}`, `{{TASK_DIR}}`, `{{DATE}}`, `{{PHASE}}`, `{{PHASE_ITERATION}}`, `{{TASK_PROMPT}}`
- Progress parsing uses exact regex patterns: `^\- \[x\]`, `^\- \[ \]`, `^## `, `⚠️`
