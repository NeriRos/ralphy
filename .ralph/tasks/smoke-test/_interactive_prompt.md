---
# User Steering (READ FIRST)

This file is for providing real-time guidance and constraints to the agent as iterations progress.
**USER: Edit this file anytime** to steer the task. Changes take effect on the next iteration.
---

**Leave this file empty if no special guidance is needed.**

---

# Task — Research Phase

You are starting a new task. Your job is to deeply research the codebase to understand the current state, then produce a RESEARCH.md documenting your findings.

**Input: Task description (injected below)**
**Output: `TASK_DIR/RESEARCH.md` (you create this)**

---

## Orient

0a. Study `CLAUDE.md` for build commands, conventions, patterns, and gotchas. This is the operational source of truth.
0b. Read `TASK_DIR/state.json` for task context: current phase, iteration count, history of previous runs, and any metadata.
0c. Never assume something is missing without searching first — use grep/glob to confirm.

## MCP Tools Available

You have access to ralph MCP tools. **Use these instead of shell commands where applicable:**

- `ralph_advance_phase(name)` — Advance this task to the next phase. **Use this instead of `./loop.sh advance`.**
- `ralph_read_document(name, document)` — Read task documents (RESEARCH.md, PLAN.md, PROGRESS.md, STEERING.md)
- `ralph_get_task(name)` — Get task status, metadata, and progress
- `ralph_list_checklists()` — List available verification checklists with their contents
- `ralph_apply_checklist(name, checklists)` — Append checklists as sections to PROGRESS.md (e.g. `["checklist_static", "checklist_tests"]`)

Task name: `smoke-test`

---

## Steps

### 1. Understand the task

Read the task description below. Identify:

- What needs to change or be created
- What existing code is likely affected
- What areas of the codebase to investigate

### 2. Deep research

**Write RESEARCH.md incrementally as you go.** Do not wait until the end — create the file early and append findings after each area of investigation. This ensures nothing is lost if the session is interrupted.

Use parallel subagents to investigate the codebase. For each area the task touches:

- **Read the actual files** that will be modified — understand their current structure, imports, exports, and patterns
- **Search for all callsites** of code that will change — find every consumer that needs updating
- **Check for edge cases** — related tests, config files, CI/CD, build scripts
- **Find existing implementations** — code that already does something similar that can be reused or extended
- **Find existing types, Zod schemas, and utilities** that overlap with the task requirements
- **Identify ordering constraints** — what must happen before what? What can be parallelized?

After each batch of investigation, immediately write or append your findings to `TASK_DIR/RESEARCH.md`.

### 3. Finalize RESEARCH.md

Review `TASK_DIR/RESEARCH.md` for completeness. Ensure it covers:

- **For each file to be modified**: current state, relevant imports/exports, callsites, what needs to change
- **For each new file**: patterns to follow (based on similar existing files), dependencies it needs
- **Existing code to reuse**: types, utilities, patterns that already exist and should be leveraged
- **Discovered issues**: extra files, hidden callsites, ordering constraints, edge cases
- **Dependency graph**: what must happen before what, what can be parallelized

Keep it factual and reference-heavy — file paths, line numbers, function names. This document is the foundation for the plan and execution checklist.

### 4. Commit and advance

```
git add TASK_DIR/RESEARCH.md
git commit -m "research: <task-name>"
```

Then advance to the planning phase so the next iteration starts correctly. Use `ralph_advance_phase` MCP tool if available, otherwise fall back to:

```
./loop.sh advance --name "smoke-test"
```

**Stop after advancing. Do not create PLAN.md or PROGRESS.md — that happens in the next phase. Do not implement anything.**

---

## Termination Signal

If you hit a blocker (task description is ambiguous, critical information is missing), write `TASK_DIR/STOP` with a one-line reason.

---

## Rules

- **RESEARCH ONLY. Do NOT implement anything. Do NOT write application code. Do NOT create PLAN.md or PROGRESS.md.**
- If RESEARCH.md already exists, you are refining it — read it first, identify gaps, then enhance.
- Phase iteration: 0. After committing, advance to planning (use `ralph_advance_phase` MCP tool if available, otherwise `./loop.sh advance`).
- Read actual files — don't guess at what's in them.
- Use parallel subagents aggressively to explore the codebase.
- The quality of the plan depends entirely on the quality of this research. Be thorough.
- Ultrathink when analyzing the codebase.
