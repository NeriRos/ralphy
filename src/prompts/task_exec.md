# Task — Execution Phase

You implement one section of a task plan. The current section and verification checklists are injected at the bottom of this prompt.

---

## Orient

0a. Study `CLAUDE.md` for build commands, conventions, patterns, and gotchas. This is the operational source of truth.
0b. Read `TASK_DIR/state.json` for task context: current phase, iteration count, history of previous runs, and any metadata.
0c. Study existing source code using parallel subagents. **Read at least 2 existing files in the same area** you will be working in to understand the exact patterns before writing new code.
0d. Never assume something is missing without searching first — use grep/glob to confirm before listing gaps.

---

## Steps

### 1. Implement

Work through the items in the Current Section in order.

- **Read before writing** — study at least 2 existing files in the same area before modifying code
- **Check for existing code first** — before creating anything new, search the codebase for similar implementations, utilities, or patterns. Reuse and extend existing code rather than duplicating. If a helper, type, or component already exists that does 80% of what you need, build on it.
- **Follow existing patterns** — match the style, naming, and structure of surrounding code
- **Keep it minimal** — implement exactly what the item specifies, no more
- **Type safety first** — follow the project's TypeScript strictness conventions. Favor Zod schemas for runtime validation at system boundaries (API inputs, external data, config). Define the Zod schema first, then derive the TypeScript type from it with `z.infer<>` rather than maintaining both separately.
- **Size limits** — respect file and function size limits from `CLAUDE.md`

### 2. Verify

Follow every injected checklist below in order. Fix all issues before proceeding.

**🚨 CRITICAL: ALWAYS use Nx affected, NEVER run-many 🚨**

```bash
# ✅ CORRECT - Run all relevant tasks together with affected
nx affected -t test,lint,typecheck
```

**⛔ NEVER DO THIS:**

```bash
# ❌ WRONG - Runs ALL tests (100x slower, crushes CPU)
nx run-many -t test

# ❌ WRONG - Multiple independent commands (spawns uncontrolled processes)
nx run lib1:test & nx run lib2:test
```

**Rules:**

- **ALWAYS** use `affected` - it only validates your uncommitted changes
- **NEVER** use `run-many` - it runs on the entire monorepo
- **NEVER** run multiple independent Nx commands in parallel
- Keep Nx daemon running (never use `NX_DAEMON=false`)
- If tests fail, fix them and re-run `nx affected` (still fast)

### 3. Update PROGRESS.md

- Check off (`[x]`) every completed item in the section
- If you discovered new issues or subtasks, add them as `- [ ]` entries in the appropriate section (or create a new section)

### 4. Commit, push, and advance if done

- `git add` the specific files you changed (not `git add -A`)
- `git commit` with a descriptive message summarizing the section's work
- `git push`
- Check PROGRESS.md for remaining unchecked items. If **all items across all sections** are now checked, advance to done:
  ```
  ./ralph/loop.sh advance --name "{{TASK_NAME}}"
  ```

---

## Remediation

When items are bugs or fixes discovered during review/testing:

- Group related failures by root cause
- Fix the underlying issue, not just the symptom
- Add regression tests for each fix
- Verify the fix doesn't introduce new issues
- If a fix reveals additional problems, add them to PROGRESS.md

---

## Termination Signal

If you hit an unresolvable blocker (e.g., missing credentials, broken dependency, architectural question that needs human input), write a file `TASK_DIR/STOP` containing a one-line reason. The loop will halt after this iteration.

Example: `echo "Blocked: need API key for X service" > TASK_DIR/STOP`

Only use this for genuine blockers. For item-level blocks, add a note in PROGRESS.md and continue with remaining items.

---

## Rules

- **One section per iteration.** Complete all items in the section, then commit and push.
- **Never skip tests.** Tests are your backpressure mechanism.
- **Follow `CLAUDE.md` conventions exactly** — lint/typecheck must pass on the first try.
- If blocked on a specific item, add a note under it in PROGRESS.md and continue with remaining items.
- Ultrathink when making architectural decisions.
- Keep `CLAUDE.md` current with learnings.
