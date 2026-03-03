# Progress — test-mcp

## Section 1 — Test Infrastructure & Registration

- [ ] Add `test` target to `apps/mcp/project.json` (`bun test apps/mcp/src`)
- [ ] Create `apps/mcp/src/__tests__/tools.test.ts` with imports, mocking setup (mock `commitState` via `mock.module`, mock `child_process.spawn`), and shared helpers (`makeState`, temp dir setup/teardown, `withStorage` wrapper)
- [ ] Write `registerTools` test: verify all 7 tools are registered with correct names by creating a mock `McpServer` with a `registerTool` spy
- [ ] Run tests to verify infrastructure works

## Section 2 — List & Get Task Tests

- [ ] Write `ralph_list_tasks` tests: empty directory, single task, multiple tasks, filtering completed tasks (`includeCompleted: false` skips done phase), tasks with and without PROGRESS.md
- [ ] Write `ralph_get_task` tests: existing task returns full details (progress, documents, steering, metadata, historyLength), missing task returns error with `isError: true`, task with missing optional documents
- [ ] Run tests to verify passing

## Section 3 — Read Document & Create Task Tests

- [ ] Write `ralph_read_document` tests: read each document type (RESEARCH.md, PLAN.md, PROGRESS.md, STEERING.md), missing document returns error, missing task returns error
- [ ] Write `ralph_create_task` tests: creates state.json and STEERING.md, duplicate task returns error, custom engine/model applied, default engine/model used when omitted
- [ ] Run tests to verify passing

## Section 4 — Run, Advance Phase & Update Steering Tests

- [ ] Write `ralph_run_task` tests: spawns subprocess with correct args (verify `spawn` mock called with expected args including optional maxIterations/engine/model), missing task returns error
- [ ] Write `ralph_advance_phase` tests: valid advance (research→plan with RESEARCH.md present), advance with explicit phase param uses `setPhase`, missing prerequisites returns error, `commitState` called on success
- [ ] Write `ralph_update_steering` tests: overwrites STEERING.md content, missing task returns error
- [ ] Run full test suite (`nx affected -t test`) to verify all MCP tests pass alongside existing tests
