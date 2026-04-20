# OpenSpec Migration — Status for Agent Team

**Branch**: `claude/simplify-paths-openspec-zaudu`
**Last commit**: `adaa5f6 feat: add openspec adapter package`

---

## User Requests (all confirmed, all must be implemented)

1. **Full OpenSpec migration** — rip out ralphy's custom phase/document system, replace with OpenSpec canonical layout (`openspec/changes/<name>/`)
2. **Share code via libs** — shared logic lives in `packages/`, imported by `apps/cli`, `apps/mcp`, and the sidecar. No duplication across apps.
3. **Abstract OpenSpec behind a Ralphy-domain interface** (`ChangeStore`) — the interface matches Ralphy's business concepts, NOT OpenSpec CLI commands. `OpenSpecChangeStore` is the concrete implementation. All app code depends on the interface, not the concrete class. Swapping backends later = only a new implementation.
4. **Q1–Q5 decisions**: (a) bunx openspec, (a) delete checklists, (a) delete specs/001-test-task, (a) clean break migration, UI sidecar needs path updates.
5. **Env var added to settings**: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` — already done in `~/.claude/settings.json`.

---

## What Is Done (committed)

### Commit `adaa5f6` — `packages/openspec/` created

- `packages/openspec/src/index.ts` — OpenSpec adapter exists but is partially broken (see errors below)
- `ChangeStore` interface partially defined

### Uncommitted changes (large, partial — ~60 files modified)

Most work is in `git diff HEAD` (unstaged). Key things partially done:

| Area                                                         | Status                                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `packages/types/src/types.ts`                                | State schema simplified — `phase`, `phaseIteration`, `totalIterations` removed; `iteration` added |
| `packages/core/src/state.ts`                                 | Updated to use `.ralph-state.json`                                                                |
| `packages/core/src/loop.ts`                                  | Partially rewritten for OpenSpec                                                                  |
| `packages/core/src/{documents,phases,templates,progress}.ts` | Deleted/emptied                                                                                   |
| `packages/phases/`                                           | Deleted                                                                                           |
| `packages/content/phases/`, `scaffolds/`, `checklists/`      | Deleted                                                                                           |
| `specs/001-test-task/`                                       | Deleted                                                                                           |
| `apps/cli/src/`                                              | Partially updated (CLI commands, loop hook, components)                                           |
| `apps/mcp/src/tools.ts`                                      | Partially rewritten — old 9 tools replaced with new 5                                             |
| `apps/ui/src-sidecar/`                                       | Partially updated — path changes started                                                          |
| `apps/ui/src/`                                               | Partially updated — phase refs partially removed                                                  |

---

## Remaining TypeScript Errors (must all be zero before commit)

### `packages/core/tsconfig.json`

- Still has `{ "path": "../phases" }` in references — **delete it** (phases package is gone)
- Same likely in `tsconfig.base.json` — grep and remove all `phases` references

### `@ralphy/openspec` not resolving (3 files)

- `apps/cli/src/components/App.tsx:10`
- `apps/mcp/src/tools.ts:8`
- `apps/cli/src/hooks/useLoop.ts:21`
- **Fix**: ensure `packages/openspec/package.json` has `"name": "@ralphy/openspec"` and `tsconfig.base.json` has path alias `"@ralphy/openspec": ["packages/openspec/src/index.ts"]`. Run `bun install` after.

### `packages/openspec/src/index.ts` (or `openspec-change-store.ts`)

- Line 40: `Property 'name' does not exist on type 'never'` — bad type narrowing, add annotation

### `apps/ui/src/components/StatusBar.tsx`

- `state.totalIterations` → replace with `state.iteration`
- `state.phase` → replace with `state.status`
- `state.phaseIteration` → remove

### `apps/ui/src/views/TaskListView.tsx`

- `PhaseBadge` import and usage — remove entirely, show `task.status` as plain text
- `task.phase` → remove
- `task.totalIterations` → replace with `task.iteration`

### `apps/mcp/src/tools.ts`

- Line 8: `@ralphy/openspec` not found (see above)
- Line 242: `appendSteering` not found — find its export location and fix the import
- All remaining `state.phase`, `state.phaseIteration` → use `state.status`, `state.iteration`

### `apps/ui/src-sidecar/routes/loop.ts`

- `noExecute` in body/LoopOptions — remove
- `currentState.phase` (lines ~212, 222, 336) — remove, use iteration number only
- `phase` field in history entry object (~377) — remove
- `phaseBeforeEngine` variable — delete entirely
- `changeStore` missing from LoopOptions passed at line ~111 — add it

### `apps/cli/src/hooks/useLoop.ts`

- Lines 162, 191: `string` not assignable to `Engine` — cast: `opts.engine as Engine`

### `apps/cli/src/loop.ts` (if separate from core)

- Lines 173, 223, 254: same `Engine` cast issue

### `apps/cli/src/index.ts`

- Line 42: `Expected 3 arguments, but got 2` — read the call and add missing argument

### `apps/ui/src-sidecar/routes/tasks.ts`

- Line 53: State object passed where `never` expected — type mismatch, fix the function signature or call

### `apps/cli/src/__tests__/loop.test.ts`

- Lines 375-376: `state.phaseIteration` / `state.totalIterations` — replace with `state.iteration`

### `apps/cli/src/__tests__/TaskLoop.test.tsx`

- Line 10: `BuildInitialStateOpts` → `BuildInitialStateOptions`
- Line 84: unused `makeLoopOpts` — remove or use
- Lines 136, 176, 215, 252, 288, 333, 365+: LoopOptions missing `changesDir` and `changeStore`; remove `noExecute`, `interactive`, `tasksDir`
- Line 269: remove `phase` from state object; cast `status` as `"active" | "blocked" | "completed"`

### `packages/phases/` (if any files still exist on disk)

- All phase files should be gone. If `phases.ts` still references `@ralphy/content`, delete it.

---

## Architecture Requirements (must be enforced)

### `ChangeStore` interface (lives in `packages/openspec/src/index.ts`)

```ts
export interface ChangeStore {
  createChange(name: string, description: string): Promise<void>;
  getChangeDirectory(name: string): string;
  listChanges(): Promise<string[]>;
  readTaskList(name: string): Promise<string>;
  writeTaskList(name: string, content: string): Promise<void>;
  appendSteering(name: string, message: string): Promise<void>;
  readSection(name: string, artifact: string, heading: string): Promise<string>;
  validateChange(name: string): Promise<{ valid: boolean; warnings: string[]; errors: string[] }>;
  archiveChange(name: string): Promise<void>;
}
```

`OpenSpecChangeStore implements ChangeStore` shells out via `bunx openspec`.
All `apps/` code types against `ChangeStore`, not `OpenSpecChangeStore`.

### State file location

- Old: `.ralph/tasks/<name>/state.json`
- New: `openspec/changes/<name>/.ralph-state.json`

### Changes directory

- Old: `.ralph/tasks/`
- New: `openspec/changes/`

### Sidecar discovery (`apps/ui/src-sidecar/server.ts`)

- Old: walks up looking for `.ralph/`
- New: walks up looking for `openspec/`

---

## Steps Still Needed

After fixing all TypeScript errors:

1. **Step 6** — Slim MCP to 5 tools: `ralph_list_changes`, `ralph_get_change`, `ralph_create_change`, `ralph_append_steering`, `ralph_stop` (tools.ts is partially done but has errors)
2. **Step 7** — Write `packages/content/base-prompt.md` (single prompt replacing 6 phase prompts)
3. **Step 8** — Update `README.md` and `CLAUDE.md`; delete/rewrite broken tests; run full typecheck clean
4. **Commit** each step separately with Conventional Commits

---

## Commands

```bash
# Check current errors
bunx nx run-many -t typecheck

# Run specific package
bunx nx run core:typecheck
bunx nx run cli:typecheck
bunx nx run mcp:typecheck
bunx nx run ui:typecheck

# Install after package.json changes
bun install
```

---

## Files Agents Should NOT Touch

- `apps/cli/src/components/TaskStatus.tsx` — already fixed (`taskDir` → `changeDir`, phase fields removed)
- `~/.claude/settings.json` — already has `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- `OPENSPEC_MIGRATION_PLAN.md` — reference only
