# Research: Smoke Test — All Phases Work

## Task Description

"smoke test to ensure all phases work" — This is a meta-task: the act of running through all phases (research, plan, exec, review, done) **is** the smoke test. The goal is to verify the Ralphy framework's phase system operates correctly end-to-end.

---

## Project Overview

Ralphy is an iterative AI task execution framework that orchestrates multi-phase autonomous work using Claude or Codex engines. It's a Bun/TypeScript Nx monorepo.

### Key Packages

| Package           | Purpose                                  | Path                              |
| ----------------- | ---------------------------------------- | --------------------------------- |
| `@ralphy/types`   | Zod schemas and TS types                 | `packages/types/src/types.ts`     |
| `@ralphy/context` | Storage abstraction                      | `packages/context/src/context.ts` |
| `@ralphy/output`  | Terminal formatting                      | `packages/output/src/output.ts`   |
| `@ralphy/phases`  | Phase loading, parsing, checklists       | `packages/phases/src/phases.ts`   |
| `@ralphy/core`    | State mgmt, phase control, progress, git | `packages/core/src/`              |
| `@ralphy/engine`  | Claude/Codex subprocess management       | `packages/engine/src/engine.ts`   |
| `@ralphy/cli`     | CLI entry point and main loop            | `apps/cli/src/`                   |
| `@ralphy/mcp`     | MCP server with tool definitions         | `apps/mcp/src/`                   |

### Dependency Graph

```
@ralphy/types
  -> @ralphy/context -> @ralphy/core
  -> @ralphy/phases -> @ralphy/core
  -> @ralphy/output -> @ralphy/engine
  -> @ralphy/engine
CLI and MCP apps consume all packages
```

---

## Phase System

### Phases (in order)

| #   | Phase    | Requires             | autoAdvance   | loopBack | Output                            |
| --- | -------- | -------------------- | ------------- | -------- | --------------------------------- |
| 1   | research | —                    | null (manual) | —        | RESEARCH.md                       |
| 2   | plan     | RESEARCH.md          | null (manual) | —        | PLAN.md, PROGRESS.md              |
| 3   | exec     | PLAN.md, PROGRESS.md | allChecked    | —        | Code changes, updated PROGRESS.md |
| 4   | review   | (current section)    | allChecked    | exec     | Issues in PROGRESS.md or approval |
| 5   | done     | —                    | — (terminal)  | —        | Task marked completed             |

Phase definitions live in `/packages/phases/phases/*.md` as markdown with YAML frontmatter.

### Phase Transition Mechanics

- **Manual transitions**: `advancePhase()` in `packages/core/src/phases.ts` — validates required files exist, records in history, resets `phaseIteration` to 0
- **Auto transitions**: `autoTransitionAfterIteration()` — triggered after every successful iteration:
  - exec: advances when all items in current section are `[x]`
  - review: loops back to exec if `⚠️` found; advances to next section or done otherwise
- **Phase inference**: `inferPhaseFromFiles()` walks phases in order, finds first whose `requires` are missing

### Prompt Building

`buildTaskPrompt()` in `apps/cli/src/loop.ts`:

1. Injects STEERING.md (max 20 non-header lines)
2. Renders phase prompt with template variables (`{{TASK_NAME}}`, `{{TASK_DIR}}`, `{{MCP_TOOLS}}`, etc.)
3. Injects context based on phase config (`type: "file"` or `type: "currentSection"`)

---

## Main Loop (`apps/cli/src/loop.ts`)

Per iteration:

1. Check stop conditions (max iterations, cost, runtime, consecutive failures, STOP file)
2. Build prompt from phase config + steering + context
3. Spawn engine subprocess (Claude/Codex) with prompt via stdin
4. Stream output, capture exit code and usage stats
5. Update state.json with iteration details
6. Auto-transition if conditions met
7. Git push (non-fatal)
8. Check for STOP signal

### Stop Conditions

- Terminal phase reached
- Max iterations exceeded
- `--max-cost` exceeded
- `--max-runtime` exceeded
- Consecutive identical failures (default: 5)
- STOP file in task directory

---

## MCP Tools (apps/mcp/src/tools.ts)

| Tool                    | Purpose                                               |
| ----------------------- | ----------------------------------------------------- |
| `ralph_list_tasks`      | List all tasks with status                            |
| `ralph_get_task`        | Get detailed task info                                |
| `ralph_read_document`   | Read task documents (RESEARCH/PLAN/PROGRESS/STEERING) |
| `ralph_create_task`     | Create new task                                       |
| `ralph_run_task`        | Run task in background                                |
| `ralph_advance_phase`   | Advance or set phase                                  |
| `ralph_update_steering` | Update STEERING.md                                    |
| `ralph_list_checklists` | List available checklists                             |
| `ralph_apply_checklist` | Append checklists to PROGRESS.md                      |

Configured in `.mcp.json` via `bun .ralph/bin/mcp.js`.

---

## Checklists (`.ralph/templates/checklists/`)

| Checklist             | Purpose                                 |
| --------------------- | --------------------------------------- |
| `checklist_static.md` | Lint, typecheck, build, format          |
| `checklist_tests.md`  | Unit, integration, E2E tests            |
| `checklist_deploy.md` | Deployment status, logs, smoke test URL |

Auto-appended to PROGRESS.md during plan-to-exec transition.

---

## Smoke-Test Task State

- **Location**: `.ralph/tasks/smoke-test/`
- **Current files**: `state.json`, `STEERING.md`, `_interactive_prompt.md`
- **Phase**: research (iteration 0)
- **Status**: active
- **No RESEARCH.md, PLAN.md, or PROGRESS.md yet**

---

## What the Smoke Test Should Verify

Since the task prompt is "smoke test to ensure all phases work," the execution phase should implement a minimal, verifiable change that exercises:

1. **Phase transitions**: research -> plan -> exec -> review -> done
2. **Auto-advance**: exec auto-advances when all items checked
3. **Review loop**: review validates and either loops back or advances
4. **State tracking**: state.json updates correctly across phases
5. **MCP tools**: advance_phase, read_document, apply_checklist all function

### Suggested Minimal Change

A trivial code change (e.g., add a comment or update a version string) that can be:

- Planned in PLAN.md with 1-2 sections
- Executed and checked off in PROGRESS.md
- Reviewed and approved
- This keeps the smoke test fast and cheap while exercising all phase machinery

---

## Key File Paths

- Phase definitions: `packages/phases/phases/{research,plan,exec,review,done}.md`
- Phase logic: `packages/core/src/phases.ts`
- State management: `packages/core/src/state.ts`
- Progress tracking: `packages/core/src/progress.ts`
- Main loop: `apps/cli/src/loop.ts`
- MCP tools: `apps/mcp/src/tools.ts`
- Type definitions: `packages/types/src/types.ts`
- Engine: `packages/engine/src/engine.ts`
- Task directory: `.ralph/tasks/smoke-test/`
