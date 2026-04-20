# Ralphy

Ralph loop framework.

## Stack

- Package Manager: bun - USE ONLY `bun` and `bun run` and `bunx` to run commands.

## Change Layout

Changes live under `.ralph/tasks/<change-name>/`. Key files:

- `proposal.md` — description and `## Steering` section
- `design.md` — technical design
- `tasks.md` — checklist driving iteration
- `specs/` — per-task specifications
- `.ralph-state.json` — loop state (iteration count, status, cost, history)

There are no phases. The loop reads `tasks.md`, works on the first unchecked item, validates, and checks it off.

## Cost Warning

Long-running changes with unlimited iterations can burn significant API usage. Use safeguards:

- `--max-iterations N` — stop after N iterations (e.g. `ralph task --name foo --max-iterations 10`)
- `--max-cost N` — stop when total cost exceeds $N
- `--max-runtime N` — stop after N minutes of wall-clock time
- `--max-failures N` — stop after N consecutive identical failures (default: 5)

- **Never reduce the coverage threshold unless told to**

## Manual UI Testing

Use agent-browser to manually test the UI at http://localhost:1420/
