# Research — test-mcp

## Task Description

Test the MCP (Model Context Protocol) server integration. Verify that the ralph MCP tools work correctly — listing tasks, reading documents, advancing phases, and updating steering. Ensure the full task lifecycle (research → plan → exec → done) functions as expected.

---

## 1. MCP Server Architecture

### Entry Point

- **File:** `apps/mcp/src/index.ts` (49 lines)
- Server name: `"ralph"`, version `"1.0.0"`
- Uses `@modelcontextprotocol/sdk` with `StdioServerTransport`
- `resolveTasksDir(startDir)` walks up from CWD to find `.ralph/tasks/`
- Accepts `--dir` CLI arg to override tasks directory
- Calls `registerTools(server, tasksDir)` then connects transport

### Tools Registration

- **File:** `apps/mcp/src/tools.ts` (402 lines)
- `registerTools(server: McpServer, tasksDir: string)` registers all 7 tools
- Allowed documents constant (line 13): `["RESEARCH.md", "PLAN.md", "PROGRESS.md", "STEERING.md"]`

### MCP Configuration

- **File:** `.mcp.json`
- Command: `bun .ralph/bin/mcp.js`
- Built binary at `dist/mcp/index.js`, copied to `.ralph/bin/mcp.js`

---

## 2. MCP Tools — Detailed Specifications

### Tool 1: `ralph_list_tasks`

- **Input:** `{ includeCompleted?: boolean }`
- **Behavior:** Enumerates `.ralph/tasks/` directories, reads each `state.json`, counts progress from `PROGRESS.md`
- **Returns:** Array of `{ name, phase, status, phaseIteration, totalIterations, progress, engine, model, createdAt, lastModified }`
- **Dependencies:** `getStorage().list()`, `readState()`, `countProgress()`
- **Edge cases:** Filters out `phase === "done"` unless `includeCompleted` is true

### Tool 2: `ralph_get_task`

- **Input:** `{ name: string }`
- **Behavior:** Reads state, progress, steering, checks for document existence
- **Returns:** `{ name, prompt, phase, status, phaseIteration, totalIterations, engine, model, createdAt, lastModified, progress, currentSection, documents[], steering, metadata, historyLength }`
- **Dependencies:** `readState()`, `countProgress()`, `extractCurrentSection()`, `getStorage().read()`

### Tool 3: `ralph_read_document`

- **Input:** `{ name: string, document: "RESEARCH.md" | "PLAN.md" | "PROGRESS.md" | "STEERING.md" }`
- **Behavior:** Reads and returns full document content
- **Returns:** `{ text: string }` or error if not found

### Tool 4: `ralph_create_task`

- **Input:** `{ name: string, prompt: string, engine?: string, model?: string }`
- **Behavior:** Creates task directory, writes `state.json` and `STEERING.md`
- **Returns:** `{ created, phase, taskDir }`
- **Validation:** Errors if task already exists

### Tool 5: `ralph_run_task`

- **Input:** `{ name: string, maxIterations?: number, engine?: string, model?: string }`
- **Behavior:** Spawns detached subprocess: `bun run apps/cli/src/index.ts task --name <name>`
- **Returns:** `{ started, pid }`
- **Note:** Process is detached and unref'd — parent can exit independently

### Tool 6: `ralph_advance_phase`

- **Input:** `{ name: string, phase?: string }`
- **Behavior:** If `phase` provided, uses `setPhase()`. Otherwise uses `advancePhase()` with validation.
- **Returns:** `{ from, to }`
- **Side effects:** Commits state change to git via `commitState()`
- **Validation rules:**
  - `research → plan`: RESEARCH.md must exist
  - `plan → exec`: PLAN.md AND PROGRESS.md must exist, unchecked items required
  - `exec → review`: Always allowed
  - `review → exec/done`: Based on ⚠️ markers and progress

### Tool 7: `ralph_update_steering`

- **Input:** `{ name: string, content: string }`
- **Behavior:** Overwrites `STEERING.md` with new content
- **Returns:** Success message
- **Validation:** Task must exist (checks `state.json`)

---

## 3. Core Dependencies Used by MCP Tools

### State Management (`packages/core/src/state.ts`)

- `readState(taskDir)` — Reads and Zod-validates `state.json`
- `writeState(taskDir, state)` — Writes formatted JSON
- `updateState(taskDir, updater)` — Atomic read-update-write
- `buildInitialState(opts)` — Creates fresh state with defaults (phase: "research", status: "active")

### Phase Transitions (`packages/core/src/phases.ts`)

- `advancePhase(state, taskDir)` — Validates and advances to next phase
- `setPhase(state, taskDir, targetPhase)` — Jumps to specific phase (with validation)
- `recordPhaseTransition(state, from, to, result?)` — Records in history array
- `autoTransitionAfterExec(state, taskDir)` — exec → review (if all items checked)
- `autoTransitionAfterReview(state, taskDir)` — review → exec/done (based on ⚠️ markers)

### Progress Tracking (`packages/core/src/progress.ts`)

- `countProgress(content)` — Returns `{ checked, unchecked, total }` by counting `- [x]` and `- [ ]`
- `extractCurrentSection(content)` — Returns first `## heading` section with unchecked items

### Git Operations (`packages/core/src/git.ts`)

- `commitState(taskDir, message)` — `git add` + `git commit` for state changes

### Storage (`packages/context/src/context.ts`)

- `getStorage()` — Returns `FileSystemProvider` via AsyncLocalStorage
- `FileSystemProvider.read(path)` — Returns content or null
- `FileSystemProvider.write(path, content)` — Creates dirs as needed
- `FileSystemProvider.list(prefix)` — Lists directory entries

---

## 4. Task Filesystem Structure

```
.ralph/tasks/<task-name>/
├── state.json      # Required — phase, iterations, history, usage
├── STEERING.md     # Created on task init — user guidance
├── RESEARCH.md     # Created during research phase
├── PLAN.md         # Created during planning phase
├── PROGRESS.md     # Created during planning phase — execution checklist
└── STOP            # Optional — blocker signal (one-line reason)
```

### State Schema (Zod-validated)

```typescript
{
  version: "1",
  name: string,
  prompt: string,
  phase: "research" | "plan" | "exec" | "review" | "done",
  phaseIteration: number,
  totalIterations: number,
  createdAt: string,          // ISO timestamp
  lastModified: string,       // ISO timestamp
  engine: "claude" | "codex",
  model: string,
  status: "active" | "completed",
  usage: { total_cost_usd, total_duration_ms, total_turns, ... },
  history: HistoryEntry[],
  metadata: { branch?: string }
}
```

---

## 5. Phase State Machine

```
research → plan → exec ↔ review → done
```

**Transition rules:**
| From | To | Condition |
|------|----|-----------|
| research | plan | RESEARCH.md exists |
| plan | exec | PLAN.md + PROGRESS.md exist, unchecked items > 0 |
| exec | review | Always (auto after exec completes) |
| review | exec | ⚠️ markers found in PROGRESS.md |
| review | done | No ⚠️ markers AND all items checked |
| review | exec | No ⚠️ markers AND unchecked items remain (next section) |

---

## 6. Build & Installation

- **Build:** `bunx nx run-many --target=build --projects=cli,mcp`
- **MCP build:** `bun build apps/mcp/src/index.ts --outdir dist/mcp --target bun`
- **Install:** `make install` (build → copy-bin → copy-assets → init-tasks → configure-mcp)
- **Test:** `nx affected -t test` (NEVER `run-many`)

---

## 7. Existing Tests

- `packages/core/__tests__/` — 4 test files (state, phases, progress, templates)
- `packages/types/__tests__/types.test.ts`
- `packages/engine/__tests__/formatters.test.ts`
- `apps/cli/__tests__/` — 3 test files (cli, loop, display)
- **No existing tests for `apps/mcp/`** — this is a gap the task should address

---

## 8. Testing Strategy Considerations

### What to test:

1. **Tool registration** — all 7 tools registered with correct names and schemas
2. **ralph_list_tasks** — empty dir, single task, multiple tasks, filtering completed
3. **ralph_get_task** — existing task, missing task, task with/without documents
4. **ralph_read_document** — each document type, missing documents
5. **ralph_create_task** — new task creation, duplicate prevention, default values
6. **ralph_run_task** — task exists, task missing (subprocess spawning is hard to unit test)
7. **ralph_advance_phase** — each valid transition, invalid transitions, missing prerequisites
8. **ralph_update_steering** — existing task, missing task, content overwrites

### Testing approach:

- Use Bun's test runner (consistent with existing tests)
- Mock `getStorage()` with in-memory provider to avoid filesystem
- Mock `commitState()` to avoid git operations
- Test through tool handler functions directly (not through MCP transport)
- Follow patterns from existing tests in `packages/core/__tests__/`

### Key files that need to be studied for test patterns:

- `packages/core/__tests__/state.test.ts` — state management test patterns
- `packages/core/__tests__/phases.test.ts` — phase transition test patterns
- `packages/core/__tests__/progress.test.ts` — progress parsing tests

---

## 9. Current Task State

The `test-mcp` task itself exists at `.ralph/tasks/test-mcp/`:

- Phase: `research`
- Iteration: 0
- Status: `active`
- Files: `state.json`, `STEERING.md` (default template)
- No RESEARCH.md, PLAN.md, or PROGRESS.md yet

---

## 10. Dependency Graph for Implementation

**No ordering constraints** — MCP tools are independent and can be tested in any order.

**Parallelizable:**

- All 7 tool test suites can be written independently
- Schema validation tests vs. behavior tests can be parallel

**Sequential:**

- Must read existing test patterns before writing new tests
- Must understand storage mocking before implementing test fixtures
