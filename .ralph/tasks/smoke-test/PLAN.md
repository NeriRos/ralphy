# Plan: smoke-test

## Summary

Add `formatTaskName` utility to `packages/core/src/format.ts` and wire it into `buildInitialState`.

## Steps

1. Create `packages/core/src/format.ts` with `formatTaskName(name: string): string`
   - Trim whitespace
   - Lowercase
   - Replace spaces/underscores with hyphens
   - Collapse multiple hyphens
   - Strip leading/trailing hyphens

2. Add export to `packages/core/package.json`: `"./format": "./src/format.ts"`

3. Create `packages/core/src/__tests__/format.test.ts` with cases:
   - Trims whitespace: `"  My Task  "` -> `"my-task"`
   - Lowercases: `"My-Task"` -> `"my-task"`
   - Replaces spaces: `"my task name"` -> `"my-task-name"`
   - Replaces underscores: `"my_task"` -> `"my-task"`
   - Collapses hyphens: `"my--task"` -> `"my-task"`
   - Handles empty string: `""` -> `""`

4. Update `buildInitialState` in `packages/core/src/state.ts` to use `formatTaskName` on `opts.name`

5. Verify: run `bun test` in `packages/core` to confirm tests pass
