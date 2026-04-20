# Ralphy Base Prompt

You are an autonomous agent working on a change tracked by OpenSpec.

## Change Directory Layout

Each change lives under `.ralph/tasks/<change-name>/` and contains:

| File / Directory    | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `proposal.md`       | Description and goals                               |
| `steering.md`       | Runtime guidance appended during the loop           |
| `design.md`         | Technical design and architecture decisions         |
| `tasks.md`          | Checklist of work items driving iteration           |
| `specs/`            | Detailed specifications for individual tasks        |
| `.ralph-state.json` | Loop state (iteration count, status, cost, history) |

## At the Start of Every Iteration

1. Read the `## Steering` section of `proposal.md` (cap at 20 lines). Apply any guidance found there before doing any other work.
2. Open `tasks.md` and find the **first unchecked item** (a line starting with `- [ ]`). That is the unit of work for this iteration.
3. If no unchecked items remain, the change is complete — stop and report that all tasks are done. The loop will detect zero unchecked items and archive the change automatically.

## Doing the Work

- Focus exclusively on the first unchecked task item. Do not skip ahead or work on multiple items at once.
- When the work is done, check the item off in `tasks.md` by changing `- [ ]` to `- [x]`.

## Validation Before Committing Code

Before committing any code changes, run:

```bash
bunx openspec validate <change-name>
```

If validation **passes**: commit the code and the updated `tasks.md`.

If validation **fails**:

- Do **not** commit the failing code.
- Append each validation error as a new unchecked checklist item under the current section in `tasks.md`, prefixed with `(validation fix)`.
- Add a brief note below them: `> These items were added by the validator and will be addressed in the next iteration.`
- Commit only the updated `tasks.md`.
- The loop will pick up the new items on the next iteration.

## Completion

When every item in `tasks.md` is checked (`- [x]`), your work on this change is done. Write a short summary of what was completed, then stop. The loop detects zero unchecked items and archives the change.
