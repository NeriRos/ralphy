# Research: smoke-test

## Objective

Add a `formatTaskName` utility function to `packages/core` that normalizes task names (trim, lowercase, replace spaces with hyphens).

## Current State of packages/core

### Structure

- `src/state.ts` — State read/write/update, `buildInitialState`
- `src/phases.ts` — Phase transitions, auto-advance logic
- `src/progress.ts` — PROGRESS.md parsing (checked/unchecked counts, section extraction)
- `src/templates.ts` — Template rendering and path resolution
- `src/git.ts` — Git operations (add, commit, push)

### Exports (package.json)

Each module is exported via subpath exports:

```json
{
  "./state": "./src/state.ts",
  "./phases": "./src/phases.ts",
  "./progress": "./src/progress.ts",
  "./git": "./src/git.ts",
  "./templates": "./src/templates.ts"
}
```

### Existing Task Name Usage

In `src/state.ts:90`, `migrateState` extracts a task name from the directory path:

```ts
const name = taskDir.split("/").pop() ?? "unknown";
```

The same pattern appears at `src/state.ts:119` in `ensureState`.

In `src/state.ts:48`, `buildInitialState` accepts `opts.name` and passes it directly into the state without normalization.

## Where formatTaskName Fits

### New File: `src/format.ts`

A new module for string formatting utilities. Keeps it separate from state/phase logic.

### Callsites to Update

- `buildInitialState` (`src/state.ts:57`) — normalize `opts.name` before storing
- `migrateState` (`src/state.ts:90`) — normalize extracted name
- `ensureState` (`src/state.ts:119`) — normalize extracted name

### Test Pattern

Existing tests are in `src/__tests__/*.test.ts`. Follow the same pattern for `format.test.ts`.

### Build

The project uses `bun` as package manager. TypeScript compilation uses project references (`tsconfig.json`). No special build step needed for `.ts` source files since exports point directly to `.ts` files.

## Dependencies

- No external dependencies needed
- No changes to `tsconfig.json` required
- `package.json` needs a new export entry: `"./format": "./src/format.ts"`
