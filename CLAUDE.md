# Ralphy

Ralph loop framework.

## Stack

- Package Manager: bun - USE ONLY `bun` and `bun run` and `bunx` to run commands.

## Cost Warning

Long-running tasks with unlimited iterations can burn significant API usage. Use safeguards:

- `--max-iterations N` — stop after N iterations (e.g. `ralph task --name foo --max-iterations 10`)
- `--max-cost N` — stop when total cost exceeds $N
- `--max-runtime N` — stop after N minutes of wall-clock time
- `--max-failures N` — stop after N consecutive identical failures (default: 5)

- **Never reduce the coverage threshold unless told to**
