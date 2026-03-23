---
name: specify
order: 0
requires: []
next: research
autoAdvance: null
loopBack: null
terminal: false
context: []
---

# Task — Specify Phase

You are starting a new task. Your job is to create a feature specification using spec-kit's specify workflow.

**Input: Task description (injected below)**
**Output: `TASK_DIR/spec.md` (you create this)**

---

## Orient

0a. Study `CLAUDE.md` for build commands, conventions, patterns, and gotchas. This is the operational source of truth.
0b. Read `TASK_DIR/state.json` for task context: current phase, iteration count, history of previous runs, and any metadata.
0c. Verify spec-kit is initialized — check that `.ralph/.claude/commands/speckit.specify.md` exists. If it does not, run `specify init --here --ai claude --force` from the `.ralph/` directory.

{{MCP_TOOLS}}

---

## Steps

### 1. Load spec-kit specify command

Read the spec-kit specify command from `.ralph/.claude/commands/speckit.specify.md`. This file contains the full specification workflow including branch creation, template structure, and quality validation.

### 2. Execute the spec-kit specify workflow

Follow all instructions in the spec-kit command file with these adaptations:

- Use the **task description** (injected below) as the `$ARGUMENTS` input
- When the command references `{SCRIPT}`, run `.ralph/.specify/scripts/bash/create-new-feature.sh` from the project root
- Pass `--json` and `--short-name` flags as specified in the command
- Let the script create the branch and `specs/<branch>/spec.md` as normal

### 3. Copy spec to task directory

After the spec-kit workflow completes, copy the generated specification to `TASK_DIR/spec.md`. This ensures ralphy can track it as a task artifact alongside RESEARCH.md, PLAN.md, and PROGRESS.md.

### 4. Quality validation

Follow the spec-kit command's quality validation steps:

- Maximum 3 `[NEEDS CLARIFICATION]` markers
- All functional requirements must be testable
- Success criteria must be measurable and technology-agnostic
- No implementation details in the specification

If clarification questions arise, present them to the user and wait for responses before finalizing.

### 5. Commit and advance

```
git add TASK_DIR/spec.md
git commit -m "specify: <task-name>"
```

Then advance to the research phase so the next iteration starts correctly. Use `mcp__ralph__ralph_advance_phase` MCP tool if available, otherwise fall back to:

```
ralph advance --name "{{TASK_NAME}}"
```

**Stop after advancing. Do not create RESEARCH.md, PLAN.md, or PROGRESS.md — that happens in later phases. Do not implement anything.**

---

## Termination Signal

If you hit a blocker (task description is ambiguous beyond resolution, critical information is missing, spec-kit is not installed), write `TASK_DIR/STOP` with a one-line reason.

---

## Rules

- **SPECIFY ONLY. Do NOT implement anything. Do NOT write application code. Do NOT create RESEARCH.md, PLAN.md, or PROGRESS.md.**
- If spec.md already exists, you are refining it — read it first, identify gaps, then enhance.
- Phase iteration: {{PHASE_ITERATION}}. After committing, advance to research (use `mcp__ralph__ralph_advance_phase` MCP tool if available, otherwise `ralph advance --name "{{TASK_NAME}}"`).
- Focus on **WHAT** users need and **WHY** — avoid HOW to implement.
- Written for business stakeholders, not developers.
- Ultrathink when analyzing requirements and edge cases.
