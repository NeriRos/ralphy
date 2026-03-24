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

You are starting a new task. Your job is to create a feature specification.

**Input: Task description (injected below)**
**Output: `TASK_DIR/spec.md` (you create this)**

---

## Orient

0a. Study `CLAUDE.md` for build commands, conventions, patterns, and gotchas. This is the operational source of truth.
0b. Read `TASK_DIR/state.json` for task context: current phase, iteration count, history of previous runs, and any metadata.

{{MCP_TOOLS}}

---

## Steps

### 1. Parse the task description

Extract from the task description:

- **Actors** — who uses this feature?
- **Actions** — what do they do?
- **Data** — what entities are involved?
- **Constraints** — any boundaries, limits, or rules?

If the description is empty or too vague to proceed, write `TASK_DIR/STOP` with a reason and stop.

### 2. Write `TASK_DIR/spec.md`

Create the spec using the template structure below. Replace all placeholders with concrete details derived from the task description.

```markdown
# Feature Specification: [FEATURE NAME]

**Created**: [DATE]
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements

### Functional Requirements

- **FR-001**: System MUST [specific capability]
- **FR-002**: System MUST [specific capability]

### Key Entities (include if feature involves data)

- **[Entity 1]**: [What it represents, key attributes without implementation]

## Success Criteria

### Measurable Outcomes

- **SC-001**: [Measurable, technology-agnostic metric]
- **SC-002**: [Measurable, technology-agnostic metric]
```

### 3. Quality validation

After writing the spec, validate:

- **No implementation details** — no languages, frameworks, APIs, or code structure
- **WHAT and WHY only** — focused on user value and business needs, not HOW
- **Testable requirements** — every FR can be verified
- **Measurable success criteria** — technology-agnostic, user-focused outcomes
- **Maximum 3 `[NEEDS CLARIFICATION]` markers** — make informed guesses for everything else, documenting assumptions

If `[NEEDS CLARIFICATION]` markers remain, present them to the user with suggested options and wait for responses before finalizing.

### 4. Commit and advance

```
git add TASK_DIR/spec.md
git commit -m "specify: <task-name>"
```

Then advance to the research phase. Use `mcp__ralph__ralph_advance_phase` MCP tool if available, otherwise fall back to:

```
ralph advance --name "{{TASK_NAME}}"
```

**Stop after advancing. Do not create RESEARCH.md, PLAN.md, or PROGRESS.md — that happens in later phases. Do not implement anything.**

---

## Termination Signal

If you hit a blocker (task description is ambiguous beyond resolution, critical information is missing), write `TASK_DIR/STOP` with a one-line reason.

---

## Rules

- **SPECIFY ONLY. Do NOT implement anything. Do NOT write application code. Do NOT create RESEARCH.md, PLAN.md, or PROGRESS.md.**
- If spec.md already exists, you are refining it — read it first, identify gaps, then enhance.
- Phase iteration: {{PHASE_ITERATION}}. After committing, advance to research (use `mcp__ralph__ralph_advance_phase` MCP tool if available, otherwise `ralph advance --name "{{TASK_NAME}}"`).
- Focus on **WHAT** users need and **WHY** — avoid HOW to implement.
- Written for business stakeholders, not developers.
- Ultrathink when analyzing requirements and edge cases.
