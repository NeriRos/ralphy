# Plan — test-mcp

## Summary

Add comprehensive unit tests for the MCP server tools (`apps/mcp/src/tools.ts`). The MCP app currently has zero tests. All 7 tools will be tested through their handler functions using mocked storage and git operations, following existing project test patterns (bun:test, `runWithContext`, temp directories).

## Approach

**Test the tool handlers directly** — not through MCP transport. Each tool handler is a function that takes validated input and returns `{ content, isError? }`. We mock the filesystem via `getStorage()` and git operations via `commitState()`.

**Test file structure:** Single test file `apps/mcp/src/__tests__/tools.test.ts` covering all 7 tools in separate `describe` blocks. This matches the project convention of colocated `__tests__/` directories.

## Key Decisions

- **Single test file vs. multiple:** Single file — the tools are all in one file and share the same mocking setup. Splitting would create unnecessary boilerplate.
- **Mock storage vs. real filesystem:** Use real temp directories (matching `state.test.ts` and `phases.test.ts` patterns) for simpler, more reliable tests. Mock only `commitState` (git) and `spawn` (child_process).
- **Testing `registerTools`:** Test that all 7 tools register by creating a mock McpServer and verifying `registerTool` calls. Then test each handler independently.

## Files Modified

| File                                   | Action | Purpose            |
| -------------------------------------- | ------ | ------------------ |
| `apps/mcp/src/__tests__/tools.test.ts` | Create | All MCP tool tests |
| `apps/mcp/project.json`                | Modify | Add `test` target  |

## Risks

- `ralph_run_task` spawns a subprocess — test only validates args passed to `spawn`, not actual execution.
- `advancePhase`/`setPhase` have complex validation — rely on core package tests for that logic; MCP tests verify the tool wiring (correct args passed, results returned, errors caught).
