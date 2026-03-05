# Plan — smoke-test

## Summary

Add a trivial exported utility `smokeTestPassed()` returning `true` to `@ralphy/core`, with a test, to verify the ralph framework phases work end-to-end.

## Approach

1. Create `packages/core/src/smoke.ts` with a single exported function
2. Create `packages/core/src/__tests__/smoke.test.ts` following `format.test.ts` pattern
3. Add `"./smoke"` export to `packages/core/package.json`
4. Run tests via `bunx nx test core`

## Files

| Action | Path                                        |
| ------ | ------------------------------------------- |
| Create | `packages/core/src/smoke.ts`                |
| Create | `packages/core/src/__tests__/smoke.test.ts` |
| Modify | `packages/core/package.json` (add export)   |

## Risks

None. New code only, no existing callsites affected.
