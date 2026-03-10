# Research: Rebuild CLI with Ink

## Task Summary

Rebuild the `@ralphy/cli` application using [Ink](https://github.com/vadimdemedes/ink) (React renderer for CLI) and [Ink UI](https://github.com/vadimdemedes/ink-ui) to replace the current chalk + console.log output with a component-based terminal UI.

---

## Current Architecture

### CLI Entry Point — `apps/cli/src/index.ts`

- Shebang `#!/usr/bin/env bun`, parses args via `parseArgs()`, dispatches by mode
- 5 modes: `task`, `list`, `status`, `advance`, `set-phase`
- All output via `log()`, `error()` from `@ralphy/output` (chalk wrappers)
- Uses `runWithContext(createDefaultContext(), ...)` for storage

### Argument Parser — `apps/cli/src/cli.ts`

- Custom hand-rolled parser (no commander/yargs)
- Returns `ParsedArgs` interface with all flags
- **This file does NOT produce any UI — pure logic. Can be reused as-is.**

### Display Functions — `apps/cli/src/display.ts`

- `showBanner(state, opts)` — Task metadata header
- `showStatus(state, taskDir)` — Detailed single-task view
- `showList(tasksDir)` — Table of incomplete tasks
- All use `log()`, `styled()`, `separator()` from `@ralphy/output`
- **These must be rewritten as Ink components**

### Main Loop — `apps/cli/src/loop.ts`

- `mainLoop(opts)` — async loop that runs engine iterations
- `buildTaskPrompt()` — constructs prompt (pure logic, reusable)
- `checkStopCondition()` — evaluates 6 stop reasons (pure logic, reusable)
- Output via `log()`, `error()`, `styled()` — **must be replaced with Ink state updates**
- `process.stdout.write()` for engine streaming — **needs Ink integration via `useStdout()` or `<Static>`**

### Output Package — `packages/output/src/output.ts`

- Exports: `log()`, `error()`, `blank()`, `separator()`, `styled()`, `kv()`
- Style types: bold, dim, gray, error, fail, warn, header, success, successBold, cyan
- All backed by `chalk` + `console.log`/`console.error`
- **7 consumers across codebase** (see callsites below)

### Engine — `packages/engine/src/engine.ts`

- `runEngine()` spawns `claude` or `codex` subprocess
- Streams stdout line-by-line through formatters
- Uses `process.stdout.write()` directly for output
- Formatters (`processClaudeLine`, `processCodexLine`) return `string[]` lines
- **Engine output goes to stdout directly — must be captured and routed to Ink**

### Stream Formatters

- `packages/engine/src/formatters/claude-stream.ts` — uses `styled()` from `@ralphy/output`
- `packages/engine/src/formatters/codex-stream.ts` — uses `styled()` from `@ralphy/output`
- Return arrays of styled strings, not raw data
- **These can continue to return strings; we route them into Ink components**

---

## Callsite Analysis: `@ralphy/output`

Files importing from `@ralphy/output`:

| File                                              | Imports Used                          |
| ------------------------------------------------- | ------------------------------------- |
| `apps/cli/src/index.ts`                           | `log`, `error`                        |
| `apps/cli/src/display.ts`                         | `log`, `styled`, `separator`          |
| `apps/cli/src/loop.ts`                            | `log`, `error`, `styled`              |
| `apps/mcp/src/index.ts`                           | `log` (MCP server — **NOT in scope**) |
| `packages/engine/src/formatters/claude-stream.ts` | `styled`                              |
| `packages/engine/src/formatters/codex-stream.ts`  | `styled`                              |
| `apps/cli/src/__tests__/display.test.ts`          | mocked `log`, `error`, `blank`        |

**Key insight**: The formatters only use `styled()` to colorize strings. They don't call `log()`. The engine itself uses `process.stdout.write()`. So the formatters can remain unchanged — they produce colored strings that Ink components can render.

---

## Callsite Analysis: `process.stdout.write()` in Engine

In `packages/engine/src/engine.ts:196,205,231,240,265,271`:

```typescript
process.stdout.write(l + "\n");
```

This writes formatter output directly to stdout. With Ink controlling stdout, we need to either:

1. Capture these lines into state and render via Ink components
2. Use Ink's `useStdout().write()` to bypass Ink rendering
3. Refactor the engine to return/emit lines instead of writing to stdout

**Option 3 is cleanest**: Make `runEngine()` accept a callback or return a stream, letting the caller decide how to render.

---

## TSConfig / JSX Configuration

Current `tsconfig.base.json` has NO JSX settings:

- No `jsx` compiler option
- No `jsxImportSource`

**Required changes for Ink (React JSX)**:

- Add `"jsx": "react-jsx"` to tsconfig
- Add `"jsxImportSource": "react"` to tsconfig
- CLI files using JSX must use `.tsx` extension

**Alternative**: Only add JSX config in the CLI's `tsconfig.json`, not the base, to avoid affecting other packages.

---

## Build System Impact

### Current Build

- `bun build apps/cli/src/index.ts --outdir dist/cli --target bun`
- Bun natively supports JSX/TSX — **no additional build tooling needed**
- NX target in `apps/cli/project.json` line 30-33

### Dependencies to Add

- `ink` (v5.x) — React renderer for CLI
- `react` — Peer dependency for Ink
- `@inkjs/ui` — UI components (Spinner, ProgressBar, Alert, etc.)

### Dependencies to Keep

- `chalk` — Still used by `@ralphy/output` for `styled()` in formatters
- All existing `@ralphy/*` packages unchanged

---

## Ink Capabilities (from docs)

### Core Components

- `<Box>` — Flexbox layout container
- `<Text>` — Styled text (color, bold, dim, underline)
- `<Newline>` — Line break
- `<Spacer>` — Flexible space
- `<Static items={[...]}>` — Render items that don't re-render (perfect for log output)

### Hooks

- `useApp()` — Access `exit()` to quit
- `useInput()` — Capture keyboard input
- `useStdout()` — Write to stdout without interfering with Ink
- `useStdin()` — Access stdin stream

### Ink UI Components (`@inkjs/ui`)

- `<Spinner label="..." />` — Loading indicator
- `<ProgressBar value={n} />` — Progress bar (0-100)
- `<Alert variant="success|error|warning|info">` — Status messages
- `<TextInput>` — Text input with autocomplete
- `<Select>` — Selection menu

### Key Pattern: `<Static>` for Streaming Output

```tsx
<Static items={logLines}>
  {(line, i) => <Text key={i}>{line}</Text>}
</Static>
<Box>
  <Spinner label="Running iteration 3..." />
</Box>
```

Items added to `<Static>` are rendered once and never re-rendered — ideal for engine stream output.

---

## Proposed Component Architecture

### New Ink Components (in `apps/cli/src/components/`)

| Component             | Replaces            | Description                            |
| --------------------- | ------------------- | -------------------------------------- |
| `App.tsx`             | `index.ts` dispatch | Root component, routes by mode         |
| `Banner.tsx`          | `showBanner()`      | Task metadata header                   |
| `TaskStatus.tsx`      | `showStatus()`      | Detailed task view                     |
| `TaskList.tsx`        | `showList()`        | Table of incomplete tasks              |
| `TaskLoop.tsx`        | `mainLoop()`        | Main loop UI with live updates         |
| `IterationOutput.tsx` | engine stream       | Streaming engine output via `<Static>` |
| `StopMessage.tsx`     | `logStopReason()`   | Stop reason display                    |

### Entry Point Changes

`index.ts` would become:

```tsx
#!/usr/bin/env bun
import { render } from "ink";
import { App } from "./components/App";
// parse args remains the same
const args = parseArgs(process.argv.slice(2));
render(<App args={args} />);
```

### Non-interactive modes (`list`, `status`, `advance`, `set-phase`)

These render once and exit. Use `render()` + `waitUntilExit()`:

```tsx
const { waitUntilExit } = render(<TaskList tasksDir={tasksDir} />);
await waitUntilExit();
```

### Task Loop Mode

The main loop requires:

1. **Banner** — Rendered once at top
2. **Iteration output** — Streaming lines via `<Static>`
3. **Live status** — Current phase, progress, spinner during engine run
4. **Stop message** — Rendered when loop ends

---

## Files to Modify

### Must Change

| File                      | Change                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `apps/cli/src/index.ts`   | Replace mode dispatch with Ink `render()`                                                                |
| `apps/cli/src/display.ts` | Rewrite as Ink components (or delete and create new component files)                                     |
| `apps/cli/src/loop.ts`    | Refactor `mainLoop()` to emit state changes instead of `log()` calls; create `useLoop()` hook or similar |
| `apps/cli/package.json`   | Add `ink`, `react`, `@inkjs/ui` dependencies                                                             |
| `apps/cli/tsconfig.json`  | Add `jsx: "react-jsx"`, `jsxImportSource: "react"`                                                       |

### May Change

| File                            | Change                                                                  |
| ------------------------------- | ----------------------------------------------------------------------- |
| `packages/engine/src/engine.ts` | Refactor to accept output callback instead of `process.stdout.write()`  |
| `packages/output/src/output.ts` | Keep `styled()` for formatters, potentially deprecate `log()`/`error()` |
| `apps/cli/project.json`         | Update build command if entry point changes to `.tsx`                   |

### Keep Unchanged

| File                          | Reason                       |
| ----------------------------- | ---------------------------- |
| `apps/cli/src/cli.ts`         | Pure argument parsing, no UI |
| `packages/types/src/types.ts` | Type definitions, no UI      |
| `packages/core/*`             | Business logic, no UI        |
| `packages/context/*`          | Storage abstraction, no UI   |
| `packages/phases/*`           | Phase config loading, no UI  |
| `packages/content/*`          | Content resolution, no UI    |
| `apps/mcp/*`                  | MCP server, separate app     |

---

## Files to Create

| File                                          | Description                                                 |
| --------------------------------------------- | ----------------------------------------------------------- |
| `apps/cli/src/components/App.tsx`             | Root Ink component                                          |
| `apps/cli/src/components/Banner.tsx`          | Banner component                                            |
| `apps/cli/src/components/TaskStatus.tsx`      | Status display component                                    |
| `apps/cli/src/components/TaskList.tsx`        | Task list table component                                   |
| `apps/cli/src/components/TaskLoop.tsx`        | Main loop UI component with live updates                    |
| `apps/cli/src/components/IterationHeader.tsx` | Iteration separator with number/time                        |
| `apps/cli/src/components/StopMessage.tsx`     | Stop reason display                                         |
| `apps/cli/src/hooks/useLoop.ts`               | Hook encapsulating loop logic, state, and engine invocation |

---

## Testing Impact

### Current Tests

| File                         | Tests                        | Impact                                                                                                    |
| ---------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `cli.test.ts` (23 tests)     | Argument parsing             | **No impact** — tests `parseArgs()` directly                                                              |
| `display.test.ts` (10 tests) | Display functions            | **Must rewrite** — tests mock `@ralphy/output` and check text output; with Ink, use `ink-testing-library` |
| `loop.test.ts` (9 tests)     | `buildTaskPrompt`, MCP tools | **Minimal impact** — tests pure functions, not UI                                                         |

### New Testing Approach

Ink provides `ink-testing-library` for testing components:

```tsx
import { render } from "ink-testing-library";
const { lastFrame } = render(<Banner state={state} opts={opts} />);
expect(lastFrame()).toContain("Ralph Loop");
```

---

## Engine Output Refactoring

The engine currently writes to stdout directly. Two approaches:

### Approach A: Callback-based (recommended)

Modify `runEngine()` to accept an `onOutput: (line: string) => void` callback:

```typescript
export async function runEngine(
  opts: RunEngineOptions & {
    onOutput?: (line: string) => void;
  },
): Promise<EngineResult> {
  const write = opts.onOutput ?? ((l: string) => process.stdout.write(l + "\n"));
  // ... replace process.stdout.write(l + "\n") with write(l)
}
```

### Approach B: Return collected output

Collect all output lines and return them. Not ideal for streaming.

### Approach C: EventEmitter

Return an EventEmitter or AsyncIterator that yields lines. More complex but cleanest for React integration.

**Approach A is simplest** — one small change to engine.ts, backward compatible (defaults to stdout).

---

## Dependency Graph & Ordering

```
1. Add dependencies (ink, react, @inkjs/ui) to apps/cli/package.json
2. Update tsconfig for JSX support
3. Refactor engine.ts to accept onOutput callback (small, backward-compatible)
4. Create Ink component files (can be done in parallel):
   a. Banner.tsx (standalone)
   b. TaskStatus.tsx (standalone)
   c. TaskList.tsx (standalone)
   d. StopMessage.tsx (standalone)
   e. IterationHeader.tsx (standalone)
   f. useLoop.ts hook (depends on loop.ts refactoring)
   g. TaskLoop.tsx (depends on useLoop + IterationHeader + StopMessage)
   h. App.tsx (depends on all components)
5. Refactor loop.ts — extract pure logic from UI concerns
6. Rewrite index.ts to use Ink render()
7. Update display.test.ts for Ink testing
8. Update project.json if entry point extension changed
9. Verify build: bun build with .tsx entry
```

**Parallelizable**: Steps 4a-4e can all be done simultaneously. Step 3 is independent of step 4.

---

## Risks and Edge Cases

### 1. Bun + Ink Compatibility

Ink v5 uses React 18. Bun supports React with JSX natively. Should work but needs verification.

### 2. Interactive Mode

`runInteractive()` spawns Claude with `stdio: "inherit"`. When Ink controls stdout, inherited stdio may conflict. **Must use `useStdin()`/`useStdout()` or temporarily unmount Ink** during interactive sessions.

### 3. Engine Streaming + Ink

Engine writes many lines per second. `<Static>` component handles this by rendering each item once. Performance should be fine as long as we batch state updates.

### 4. `process.exit()` Calls

Current code uses `process.exit(1)` in error paths. With Ink, should use `useApp().exit()` or `process.exitCode = 1` + clean exit.

### 5. Non-TTY Environments

Ink requires a TTY. If stdout is piped, Ink may not render properly. Need to detect and fall back to plain output or use `render({}, {stdout: process.stdout})` options.

### 6. `@ralphy/output` Used by Engine Formatters

The formatters in `packages/engine/` import `styled()` from `@ralphy/output`. This is fine — `styled()` returns ANSI-colored strings that Ink's `<Text>` can render. Chalk and Ink coexist since both output ANSI codes.

### 7. MCP Server (`apps/mcp/`)

The MCP server also imports from `@ralphy/output` but only uses `log()`. It's a separate app and should NOT be affected by this change.

---

## Existing Code to Reuse

- `parseArgs()` from `cli.ts` — argument parsing, completely reusable
- `buildTaskPrompt()` from `loop.ts` — prompt construction, pure logic
- `buildTemplateVars()` from `loop.ts` — template variable building
- `checkStopCondition()` from `loop.ts` — stop condition evaluation
- `updateStateIteration()` from `loop.ts` — state update after iteration
- `checkStopSignal()` from `loop.ts` — STOP file detection
- `styled()` from `@ralphy/output` — ANSI colorization (used by formatters)
- All `@ralphy/core/*` functions — state, phases, progress, git, templates
- All formatter functions — `processClaudeLine()`, `processCodexLine()`

---

## Summary of Scope

- **New dependencies**: `ink`, `react`, `@inkjs/ui`, `@types/react` (dev)
- **New files**: ~8 component/hook files in `apps/cli/src/components/` and `apps/cli/src/hooks/`
- **Modified files**: 5-6 files (index.ts, display.ts, loop.ts, package.json, tsconfig.json, possibly engine.ts)
- **Deleted files**: display.ts content replaced by components (file may be kept or deleted)
- **Test updates**: display.test.ts must be rewritten; cli.test.ts and loop.test.ts minimal changes
- **No changes** to: types, core, context, phases, content, engine formatters, MCP server
