# Plan: Rebuild CLI with Ink

## Summary

Replace the chalk + `console.log` output layer in `@ralphy/cli` with [Ink](https://github.com/vadimdemedes/ink) (React for CLI) and [@inkjs/ui](https://github.com/vadimdemedes/ink-ui). The CLI's pure logic (arg parsing, prompt building, stop conditions) stays untouched. Only the rendering layer changes.

## Approach

1. **Engine output callback** — Refactor `runEngine()` to accept an `onOutput` callback instead of writing to `process.stdout` directly. This is backward-compatible (defaults to stdout).
2. **Ink components** — Create React components that replace `display.ts` functions (`showBanner`, `showStatus`, `showList`) and the loop's inline `log()` calls.
3. **Entry point** — Convert `index.ts` to render an `<App>` component via Ink's `render()`. Non-interactive modes render once and exit; the task loop renders live with streaming output.
4. **Tests** — Rewrite `display.test.ts` using `ink-testing-library`. Other tests are unaffected.

## Key Architectural Decisions

- **JSX config scoped to CLI only** — Add `jsx: "react-jsx"` and `jsxImportSource: "react"` to `apps/cli/tsconfig.json`, not the base tsconfig. This avoids affecting other packages.
- **Engine callback pattern** — `runEngine()` gets an `onOutput?: (line: string) => void` parameter. When omitted, falls back to `process.stdout.write()`. This keeps the engine package decoupled from Ink.
- **`<Static>` for streaming** — Engine output lines accumulate in state and render via Ink's `<Static>` component (rendered once, never re-rendered). Live status (spinner, phase, progress) renders below.
- **`styled()` stays** — Formatters in `@ralphy/engine` continue using `styled()` from `@ralphy/output` to produce ANSI strings. Ink's `<Text>` renders ANSI natively. No formatter changes needed.
- **`@ralphy/output` not deleted** — It's still used by the MCP server and engine formatters. The CLI stops importing `log()`/`error()` but `styled()` remains in use.
- **Non-TTY fallback** — Detect `process.stdout.isTTY` and skip Ink rendering for piped output, falling back to plain text.

## Files to Create

| File                                          | Description                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/cli/src/components/App.tsx`             | Root component — routes by mode, renders appropriate sub-component       |
| `apps/cli/src/components/Banner.tsx`          | Task metadata header (replaces `showBanner()`)                           |
| `apps/cli/src/components/TaskStatus.tsx`      | Detailed task view (replaces `showStatus()`)                             |
| `apps/cli/src/components/TaskList.tsx`        | Task list table (replaces `showList()`)                                  |
| `apps/cli/src/components/TaskLoop.tsx`        | Main loop UI — banner, streaming output, live status, stop message       |
| `apps/cli/src/components/IterationHeader.tsx` | Iteration separator with number and timestamp                            |
| `apps/cli/src/components/StopMessage.tsx`     | Stop reason display                                                      |
| `apps/cli/src/hooks/useLoop.ts`               | Hook wrapping loop logic — manages state, runs engine, tracks iterations |

## Files to Modify

| File                                     | Change                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| `apps/cli/package.json`                  | Add `ink`, `react`, `@inkjs/ui` deps; add `@types/react` dev dep                           |
| `apps/cli/tsconfig.json`                 | Add `jsx: "react-jsx"`, `jsxImportSource: "react"`                                         |
| `apps/cli/project.json`                  | Update build command entry point if needed (bun handles .tsx natively)                     |
| `packages/engine/src/engine.ts`          | Add `onOutput` callback parameter to `runEngine()`, replace `process.stdout.write()` calls |
| `apps/cli/src/index.ts`                  | Replace imperative dispatch with Ink `render(<App />)`                                     |
| `apps/cli/src/loop.ts`                   | Extract pure loop logic for use by `useLoop` hook; remove direct `log()` calls             |
| `apps/cli/src/display.ts`                | Delete or gut — functionality moves to components                                          |
| `apps/cli/src/__tests__/display.test.ts` | Rewrite using `ink-testing-library` to test new components                                 |

## Files Unchanged

- `apps/cli/src/cli.ts` — Pure arg parsing
- `packages/output/src/output.ts` — Still used by engine formatters and MCP
- `packages/engine/src/formatters/*` — Return string arrays, no change
- All `@ralphy/core`, `@ralphy/types`, `@ralphy/context`, `@ralphy/phases`, `@ralphy/content` packages
- `apps/mcp/*` — Separate application

## Risks

1. **Bun + Ink v5 + React 18** — Should work (Bun has native JSX/React support) but needs build verification.
2. **Interactive mode (`stdio: "inherit"`)** — When Ink controls stdout, inherited stdio may conflict. May need to unmount Ink or use raw mode during interactive sessions.
3. **Non-TTY environments** — Ink needs a TTY. Must detect and handle piped output gracefully.
4. **`process.exit()` calls** — Current error paths use `process.exit(1)`. With Ink, should use `useApp().exit()` for clean teardown.
5. **`verbatimModuleSyntax`** — Base tsconfig has this enabled. React type imports need `import type` syntax. Verify Ink/React imports work with this setting.

## Open Questions

- Should the non-interactive modes (`list`, `status`, `advance`, `set-phase`) use Ink at all? They render once and exit. Plain `console.log` would be simpler, but Ink keeps the UI consistent. **Decision: use Ink for `list`/`status` (they benefit from layout), keep `advance`/`set-phase` as simple log output since they're one-liners.**
