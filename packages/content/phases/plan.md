---
name: plan
order: 2
requires: [RESEARCH.md]
next: exec
autoAdvance: null
loopBack: null
terminal: false
context:
  - type: file
    file: RESEARCH.md
    label: "Research Findings"
---

# Task — Planning Phase

You have a RESEARCH.md with detailed codebase findings. Your job is to create an implementation plan and execution checklist.

**Input: `TASK_DIR/RESEARCH.md` (already exists)**
**Output: `TASK_DIR/PLAN.md` and `TASK_DIR/PROGRESS.md` (you create both)**

---

## Orient

0a. Study `CLAUDE.md` for build commands, conventions, patterns, and gotchas. This is the operational source of truth.
0b. Read `TASK_DIR/state.json` for task context: current phase, iteration count, history of previous runs, and any metadata.
0c. Read `TASK_DIR/RESEARCH.md` thoroughly — it contains the codebase analysis, file details, callsites, and dependency graph.
0d. You may do additional targeted searches if the research missed something, but most exploration should already be done.
0e. If PLAN.md and PROGRESS.md already exist, you are refining them — review, identify issues, improve.
0f. Phase iteration: {{PHASE_ITERATION}}. After committing, advance to execution (use `ralph_advance_phase` MCP tool if available, otherwise `./loop.sh advance`).

{{MCP_TOOLS}}

---

## Steps

### 1. Read the research

Read `TASK_DIR/RESEARCH.md` end to end. Absorb:

- Current state of every file that will be modified
- All callsites and consumers that need updating
- Existing code to reuse
- Discovered issues and edge cases
- Dependency graph and ordering constraints

### 2. Gap analysis

Compare the research findings against what the task requires. For each gap, note:

- What exists (if partial)
- What's missing
- Dependencies on other items
- Priority (critical path items first)

### 3. Create PLAN.md

Write `TASK_DIR/PLAN.md` with:

- A brief summary of the task and approach
- Key architectural decisions and trade-offs
- Files that will be created or modified
- Risks or open questions

### 4. Create PROGRESS.md

Write `TASK_DIR/PROGRESS.md` as a detailed execution checklist. Structure:

- Each `## Section N — Title` = one iteration (one agent invocation)
- Items within a section should be completable together in one iteration
- Later sections can depend on earlier sections
- Items within a section should be as independent as possible

Rules:

- **Each item must be specific and implementable** — include file paths, function names, what changes
- **No vague items** like "improve performance" or "clean up code"
- **Include test items** alongside implementation items (not in a separate section)
- **Include a final section** for integration testing, verification, and cleanup
- **Order by dependency** — critical-path items first within each section
- **Keep sections reasonably sized** — 3-8 items per section is ideal

### 5. Append verification checklists

Use `ralph_list_checklists` to see available verification checklists, then `ralph_apply_checklist` to append the relevant ones as final sections of PROGRESS.md before advancing to exec. Checklists are auto-appended during phase transition as a fallback, but explicitly choosing which ones to include is preferred.

### 6. Commit and advance

```
git add TASK_DIR/PLAN.md TASK_DIR/PROGRESS.md
git commit -m "plan: <task-name>"
```

Then advance to the execution phase so the next iteration starts correctly. Use `ralph_advance_phase` MCP tool if available, otherwise fall back to:

```
./loop.sh advance --name "{{TASK_NAME}}"
```

**Stop after advancing. Do not implement anything.**

---

## Termination Signal

If you cannot proceed (e.g., research is insufficient, critical information is missing, or a dependency is unresolvable), write a file `TASK_DIR/STOP` containing a one-line reason. The loop will halt after this iteration.

Only use this for genuine blockers — not for normal completion (the loop handles that automatically).

---

## Rules

- **PLAN ONLY. Do NOT implement anything. Do NOT write application code.**
- Base your plan on the research findings — don't re-explore what's already documented.
- Ultrathink when analyzing architecture and priorities.
- Keep each checklist item a single implementable unit of work.
