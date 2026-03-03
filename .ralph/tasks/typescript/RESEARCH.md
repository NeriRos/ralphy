# Research — typescript

> Task: Convert the current project into TypeScript with Nx and Bun (latest versions), using the current project as the template.
> Created: 2026-03-03

## Current Project Inventory

### Directory Structure

```
/Users/personal/Developer/ralphy/
├── Makefile                           # Install script (copies src/bin → .ralph/bin)
├── skills-lock.json                   # Claude Code skills config
├── .claude/settings.local.json        # Claude Code permissions
├── .ralph/                            # Installation output (runtime)
│   ├── .gitignore
│   ├── bin/                           # Copied from src/bin at install time
│   └── tasks/                         # Task state directories
├── src/
│   ├── bin/
│   │   ├── loop.sh                    # Main orchestration engine (1052 lines)
│   │   ├── formatters/
│   │   │   ├── format-claude-stream.sh  (253 lines)
│   │   │   └── format-codex-stream.sh   (403 lines)
│   │   ├── prompts/
│   │   │   ├── task_research.md
│   │   │   ├── task_plan.md
│   │   │   ├── task_exec.md
│   │   │   └── task_review.md
│   │   └── templates/
│   │       ├── PLAN.md, PROGRESS.md, STEERING.md
│   │       ├── checklist_tests.md, checklist_static.md, checklist_deploy.md
│   │       └── do_list.md (empty, likely unused)
│   ├── tasks/.gitkeep
│   └── gitignore                      # Template .gitignore for .ralph/
└── dist/                              # Empty output directory
```

### Files to Convert

#### 1. `src/bin/loop.sh` — Main Loop Engine (1052 lines)

**Functional decomposition:**

| Function                         | Lines    | Purpose                            | Conversion Notes                            |
| -------------------------------- | -------- | ---------------------------------- | ------------------------------------------- |
| `parse_args()`                   | 77-156   | CLI argument parsing               | Use `commander` or `yargs` or manual parser |
| `validate_task_name()`           | 162-168  | Regex validation                   | Simple regex                                |
| `validate_task_mode()`           | 170-184  | Mode/task validation               |                                             |
| `resume_existing_task()`         | 186-207  | Load state from state.json         | `fs.readFileSync` + JSON.parse              |
| `create_new_task()`              | 209-216  | Create task directory              | `fs.mkdirSync`                              |
| `validate_named_mode()`          | 218-228  | Validate mode requires name        |                                             |
| `validate_set_phase_mode()`      | 230-242  | Validate set-phase                 |                                             |
| `validate_mode()`                | 244-258  | Route to correct validator         |                                             |
| `render_template()`              | 264-281  | Mustache-style template rendering  | String replace + `jq` → native JSON         |
| `scaffold_task_files()`          | 283-287  | Copy STEERING.md template          | `fs.copyFileSync`                           |
| `extract_current_section()`      | 294-321  | AWK: find first unchecked section  | Parse markdown in TS                        |
| `count_progress()`               | 323-329  | Count checked/unchecked items      | Regex on file content                       |
| `infer_phase_from_files()`       | 335-341  | Detect phase from file existence   | `fs.existsSync` checks                      |
| `build_state_json()`             | 344-385  | Create initial state.json          | Object construction + `JSON.stringify`      |
| `init_state()`                   | 387-389  | Write initial state                |                                             |
| `migrate_state()`                | 391-396  | Migrate legacy tasks               |                                             |
| `ensure_state()`                 | 398-406  | Ensure state.json exists           |                                             |
| `detect_phase()`                 | 408-414  | Read phase from state              |                                             |
| `update_state_json()`            | 418-423  | Atomic jq update                   | Read + modify + atomic write                |
| `update_state_iteration()`       | 425-451  | Record iteration in state          |                                             |
| `record_phase_transition()`      | 453-475  | Record phase change                |                                             |
| `commit_state()`                 | 477-484  | Git add + commit state.json        | `child_process.execSync`                    |
| `advance_phase()`                | 490-559  | Phase state machine                |                                             |
| `set_phase()`                    | 561-590  | Jump to any phase                  |                                             |
| `show_status()`                  | 596-645  | Display task status                | Console output with ANSI                    |
| `show_list()`                    | 647-679  | List incomplete tasks              | Read all task dirs                          |
| `show_banner()`                  | 681-723  | Display startup banner             |                                             |
| `build_task_prompt()`            | 729-779  | Assemble prompt for engine         | String concatenation + file reads           |
| `run_engine()`                   | 785-804  | Execute claude/codex CLI           | `child_process.spawn` with pipe             |
| `handle_engine_failure()`        | 806-833  | Handle non-zero exits              |                                             |
| `auto_transition_after_exec()`   | 839-850  | Exec → review auto-transition      |                                             |
| `auto_transition_after_review()` | 852-885  | Review → exec/done auto-transition |                                             |
| `git_push()`                     | 891-898  | Push to remote                     | `child_process.execSync`                    |
| `check_stop_signal()`            | 904-921  | Check for STOP file                | `fs.existsSync`                             |
| `should_continue()`              | 924-935  | Check loop termination             |                                             |
| Main loop                        | 968-1052 | Iteration loop                     |                                             |

**External dependencies used in shell:**

- `jq` — JSON manipulation (heavy usage for state.json) → native in TS
- `git` — branch detection, add, commit, push → `child_process.execSync`
- `claude` CLI — pipe prompt, stream-json output → `child_process.spawn`
- `codex` CLI — pipe prompt, JSONL output → `child_process.spawn`
- `awk` — section extraction from PROGRESS.md → regex/line parsing
- `sed` — template rendering → `String.replace()`
- `grep` — pattern matching in files → `String.match()` / file reads
- `mktemp` — temp file for prompt → can use in-memory or `os.tmpdir()`
- `date` — ISO timestamps → `new Date().toISOString()`

#### 2. `src/bin/formatters/format-claude-stream.sh` (253 lines)

**Purpose:** Parse Claude `--output-format stream-json` into readable terminal output.

**Key functionality:**

- Line-by-line JSON parsing of streaming events
- Event types: `system` (init, task_started), `assistant` (text, tool_use, thinking), `user` (tool_result), `result`
- ANSI color output (bold, dim, italic, cyan, green, red, gray)
- Usage stats accumulation into state.json via `update_state_usage()`
- Compact vs verbose modes
- Optional raw JSON logging
- Exit code 130 if stream interrupted without result

**Conversion approach:** Stream transformer / readline-based parser in TS. Use `chalk` or raw ANSI for colors.

#### 3. `src/bin/formatters/format-codex-stream.sh` (403 lines)

**Purpose:** Parse Codex `exec --json` JSONL into readable terminal output.

**Key functionality:**

- More complex event structure (thread.started, turn.started/completed, tool events, response events)
- Deeply nested tool name/input/output extraction (`jq` with many fallback paths)
- Rate limit detection (exit 42)
- Non-JSON stderr handling (panics, errors, tracebacks)
- Verbose and compact modes

**Conversion approach:** Similar stream transformer. The deep jq extractions become TypeScript optional chaining.

#### 4. Prompt Templates (`src/bin/prompts/*.md`)

These are **static markdown files** with `{{VARIABLE}}` placeholders. They don't need conversion — just need to be bundled/accessible at runtime.

Files: `task_research.md` (87 lines), `task_plan.md` (100 lines), `task_exec.md` (126 lines), `task_review.md` (101 lines)

#### 5. Scaffolding Templates (`src/bin/templates/`)

Also **static files** copied into task directories. No conversion needed — just bundle them.

Files: `PLAN.md`, `PROGRESS.md`, `STEERING.md`, `checklist_tests.md`, `checklist_static.md`, `checklist_deploy.md`, `do_list.md`

#### 6. `Makefile`

**Current behavior:**

- `make install [path]` → copies `src/bin` to `[path]/.ralph/bin`
- Preserves existing `tasks/` directory
- Adds `"ralph"` script to `package.json` if it exists

**Conversion:** Replace with an Nx-based build + install script. The Makefile can become an npm/bun script or be kept as a wrapper.

## Target Architecture: Nx + Bun + TypeScript

### Nx Workspace Setup

**Latest versions (as of 2026-03):**

- `create-nx-workspace` v22.x (latest is ~22.5)
- Bun as package manager: `--pm=bun`
- TypeScript preset: `--preset=ts`

**Command:**

```bash
npx create-nx-workspace@latest ralph --pm=bun --preset=ts
```

### Recommended Project Structure

```
/Users/personal/Developer/ralphy/
├── nx.json                          # Nx configuration
├── package.json                     # Root package.json (bun workspaces)
├── tsconfig.base.json               # Shared TS config (composite: true)
├── bun.lock                         # Bun lockfile
├── packages/
│   └── ralph/                       # Main package
│       ├── package.json             # Package config
│       ├── tsconfig.json            # Extends base, project refs
│       ├── src/
│       │   ├── index.ts             # Entry point / CLI
│       │   ├── loop.ts              # Main loop engine
│       │   ├── cli.ts               # Argument parsing
│       │   ├── state.ts             # State management (state.json)
│       │   ├── phases.ts            # Phase transitions
│       │   ├── progress.ts          # PROGRESS.md parsing
│       │   ├── templates.ts         # Template rendering
│       │   ├── display.ts           # Banner, status, list display
│       │   ├── engine.ts            # Engine execution (claude/codex)
│       │   ├── git.ts               # Git operations
│       │   ├── formatters/
│       │   │   ├── claude-stream.ts # Claude stream formatter
│       │   │   └── codex-stream.ts  # Codex stream formatter
│       │   └── types.ts             # Shared types + Zod schemas
│       ├── prompts/                 # Static markdown (bundled)
│       │   ├── task_research.md
│       │   ├── task_plan.md
│       │   ├── task_exec.md
│       │   └── task_review.md
│       └── templates/               # Static templates (bundled)
│           ├── PLAN.md
│           ├── PROGRESS.md
│           ├── STEERING.md
│           └── checklist_*.md
├── .claude/                         # Preserved
├── .ralph/                          # Installation target (unchanged)
│   ├── tasks/                       # Task state (unchanged)
│   └── bin/                         # Now contains compiled JS or bun binary
└── dist/                            # Build output
```

### Key Technical Decisions

#### 1. Module System

- Use **ESM** (`"type": "module"` in package.json)
- TypeScript with `"module": "nodenext"`, `"moduleResolution": "nodenext"`

#### 2. TypeScript Configuration

Root `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "strict": true,
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  }
}
```

#### 3. Static File Bundling

Prompts and templates are **read at runtime** via `fs.readFileSync`. Store them alongside compiled output or use `__dirname` resolution. Bun handles `import.meta.dir` natively.

#### 4. CLI Entry Point

Use `#!/usr/bin/env bun` shebang for the CLI entry. Or use `#!/usr/bin/env node` for broader compatibility (Bun can run Node scripts).

#### 5. Dependencies

**Runtime:**

- `chalk` (or raw ANSI — the shell scripts already use raw codes, could keep that pattern)
- `zod` (for state.json schema validation)
- No need for `commander`/`yargs` — the existing parser is simple enough to port directly

**Dev:**

- `@nx/js` or `@nx/node` plugin
- `typescript`
- `vitest` or `bun:test` for testing

#### 6. Build Strategy

- Nx builds the TypeScript package
- Output goes to `dist/`
- Install script copies `dist/` contents to `.ralph/bin/` (replacing the current `src/bin` copy)
- OR: the install script just symlinks/copies the built package

### Type System Design

#### State Schema (Zod)

```typescript
const UsageSchema = z.object({
  total_cost_usd: z.number().default(0),
  total_duration_ms: z.number().default(0),
  total_turns: z.number().default(0),
  total_input_tokens: z.number().default(0),
  total_output_tokens: z.number().default(0),
  total_cache_read_input_tokens: z.number().default(0),
  total_cache_creation_input_tokens: z.number().default(0),
});

const HistoryEntrySchema = z.object({
  timestamp: z.string(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  phase: z.string(),
  iteration: z.number(),
  engine: z.string(),
  model: z.string(),
  result: z.string(),
  usage: z.record(z.number()).optional(),
});

const StateSchema = z.object({
  version: z.literal("1"),
  name: z.string(),
  prompt: z.string(),
  phase: z.enum(["research", "plan", "exec", "review", "done"]),
  phaseIteration: z.number().default(0),
  totalIterations: z.number().default(0),
  createdAt: z.string(),
  lastModified: z.string(),
  engine: z.enum(["claude", "codex"]),
  model: z.string(),
  status: z.enum(["active", "completed", "blocked"]),
  usage: UsageSchema,
  history: z.array(HistoryEntrySchema),
  metadata: z.object({
    branch: z.string(),
  }),
  last_iteration_usage: z.record(z.number()).optional(),
});
```

#### Phase Enum

```typescript
type Phase = "research" | "plan" | "exec" | "review" | "done";
type Engine = "claude" | "codex";
type Mode = "task" | "list" | "status" | "advance" | "set-phase";
```

### Key Shell → TypeScript Mappings

| Shell Pattern                                  | TypeScript Equivalent                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- | --- | --- | ------------------------------------ |
| `jq -r '.field'`                               | `JSON.parse(fs.readFileSync(path, 'utf-8')).field`                                  |
| `jq '...' file > file.tmp && mv file.tmp file` | `fs.writeFileSync(path, JSON.stringify(obj))` with atomic write via `fs.renameSync` |
| `sed -e 's                                     | {{VAR}}                                                                             | val | g'` | `content.replaceAll('{{VAR}}', val)` |
| `awk '/^## / { ... }'`                         | Line-by-line regex parsing                                                          |
| `grep -c '^\- \[ \]'`                          | `content.match(/^- \[ \]/gm)?.length ?? 0`                                          |
| `set -euo pipefail`                            | Try/catch + explicit error handling                                                 |
| `echo -e "\033[1m..."`                         | `chalk.bold(...)` or raw ANSI                                                       |
| `git branch --show-current`                    | `execSync('git branch --show-current').toString().trim()`                           |
| `cat file \| claude -p ...`                    | `spawn('claude', [...], { stdio: ['pipe', 'pipe', 'pipe'] })`                       |
| `while IFS= read -r line`                      | `readline.createInterface` or `for await (const line of ...)`                       |
| `mktemp`                                       | `path.join(os.tmpdir(), 'ralph-' + randomId)`                                       |
| `date -u '+%Y-%m-%dT%H:%M:%SZ'`                | `new Date().toISOString()`                                                          |

### Existing Patterns to Preserve

1. **Atomic state writes** — Always write to `.tmp` then rename
2. **Phase state machine** — research → plan → exec ↔ review → done
3. **Auto-transitions** — exec→review (all checked), review→exec (issues), review→done (clean)
4. **Template variables** — `{{TASK_NAME}}`, `{{TASK_DIR}}`, `{{DATE}}`, `{{PHASE}}`, `{{PHASE_ITERATION}}`, `{{TASK_PROMPT}}`
5. **STEERING.md injection** — Read at start of every phase, inject into prompt
6. **Git push after every iteration** — with fallback chain
7. **STOP signal** — Check for STOP file after each iteration
8. **Usage accumulation** — Formatter writes usage stats back to state.json
9. **Compact/verbose display modes** — Both formatters support this
10. **Exit codes** — 42 (rate limit), 130 (interrupted), 137 (killed), 1 (general error)

### Risks & Edge Cases

1. **Bun compatibility with `claude` CLI** — Need to verify `Bun.spawn` or `child_process.spawn` works correctly with Claude CLI's stream-json output
2. **Bun vs Node for streams** — Bun's `readline` and stream handling may differ slightly from Node
3. **Static file resolution** — Need to ensure prompts/templates are found at runtime regardless of how ralph is invoked (installed vs dev)
4. **Backward compatibility** — Existing `.ralph/tasks/` directories with state.json files must continue to work
5. **jq removal** — Currently jq is required at runtime; TypeScript version eliminates this dependency entirely
6. **Makefile replacement** — Need to maintain the `make install` workflow or provide equivalent `bun run install`

### Dependency Graph (ordering constraints)

1. **First:** Initialize Nx workspace structure (nx.json, package.json, tsconfig)
2. **Then:** Create the `ralph` package scaffolding
3. **Then (parallel):**
   - Types/schemas (`types.ts`)
   - Static files (copy prompts + templates into package)
4. **Then:** Core modules (no circular deps):
   - `state.ts` (depends on types)
   - `progress.ts` (standalone)
   - `templates.ts` (standalone)
   - `git.ts` (standalone)
   - `display.ts` (depends on state types)
5. **Then:** Higher-level modules:
   - `phases.ts` (depends on state, progress)
   - `engine.ts` (depends on formatters)
   - `formatters/claude-stream.ts` (depends on types, state)
   - `formatters/codex-stream.ts` (depends on types)
6. **Then:** Orchestration:
   - `cli.ts` (depends on everything)
   - `loop.ts` (depends on everything)
   - `index.ts` (entry point, wires cli + loop)
7. **Finally:** Build configuration, install script, tests
