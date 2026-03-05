# Research — smoke-test

## Task Summary

Add an exported utility function `smokeTestPassed()` returning `true` to `@ralphy/core`, with a test.

## Files to Create

### `packages/core/src/smoke.ts`

- Simple function: `export function smokeTestPassed(): boolean { return true; }`
- Pattern follows `packages/core/src/format.ts` (line 5–12): single exported function, no dependencies.

### `packages/core/src/__tests__/smoke.test.ts`

- Pattern follows `packages/core/src/__tests__/format.test.ts`:
  - Uses `import { describe, expect, test } from "bun:test"`
  - Imports from `"../smoke"`
  - Single describe block with one test asserting `smokeTestPassed() === true`

## Files to Modify

### `packages/core/package.json` (line 6–13)

- Add `"./smoke": "./src/smoke.ts"` to the `"exports"` map.
- Current exports: `./state`, `./phases`, `./progress`, `./git`, `./templates`, `./format`.

## Build / Test Commands

- Run tests: `bunx nx test core` (per CLAUDE.md: use nx for libs)
- No build step needed — package uses direct `.ts` exports.

## Dependency Graph

1. Create `smoke.ts` (no deps)
2. Create `smoke.test.ts` (depends on smoke.ts)
3. Update `package.json` exports (independent of tests)
4. Run tests to verify

All steps are straightforward with no callsites to update (new code only).
