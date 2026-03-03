# Plan — typescript

> Convert the ralphy project from bash scripts to TypeScript with Nx and Bun.

## Summary

Rewrite the shell-based task orchestration system (`loop.sh` + formatters) as a TypeScript project in an Nx monorepo using Bun as the runtime and package manager. The result is a `packages/ralph` package that compiles to a CLI binary, replacing `src/bin/`.

## Approach

1. **Scaffold the Nx workspace** at the repo root alongside existing files
2. **Create the `packages/ralph` package** with TypeScript config
3. **Port bottom-up** — types/schemas first, then standalone utilities, then orchestration, then CLI entry
4. **Copy static assets** (prompts, templates) into the package — read at runtime via `import.meta.dir`
5. **Replace Makefile** with an Nx build target + bun install script
6. **Preserve backward compatibility** — existing `.ralph/tasks/` state.json files must work unchanged

## Architectural Decisions

| Decision          | Choice                                          | Rationale                                                  |
| ----------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| Package manager   | Bun                                             | User requested; fast installs, native TS execution         |
| Module system     | ESM (`"type": "module"`)                        | Modern standard, Bun-native                                |
| CLI framework     | Manual parser (port existing)                   | Existing arg parser is simple; no need for commander/yargs |
| Colors            | `chalk`                                         | Clean API, widely used; replaces raw ANSI codes            |
| Schema validation | `zod`                                           | Type-safe state.json parsing, derive TS types              |
| Test framework    | `bun:test`                                      | Zero-config with Bun, fast                                 |
| Stream parsing    | `readline` + line-by-line                       | Direct port of existing line-based shell parsers           |
| Static files      | Runtime `fs.readFileSync` via `import.meta.dir` | Simple, Bun-native path resolution                         |
| Build output      | `dist/` via Nx                                  | Standard Nx convention                                     |

## Files Created

| File                                             | Purpose                                          |
| ------------------------------------------------ | ------------------------------------------------ |
| `nx.json`                                        | Nx workspace config                              |
| `package.json`                                   | Root workspace (bun workspaces)                  |
| `tsconfig.base.json`                             | Shared TypeScript config                         |
| `packages/ralph/package.json`                    | Package config with bin entry                    |
| `packages/ralph/tsconfig.json`                   | Project TS config                                |
| `packages/ralph/src/types.ts`                    | Zod schemas + derived types                      |
| `packages/ralph/src/state.ts`                    | State management (read/write/migrate state.json) |
| `packages/ralph/src/progress.ts`                 | PROGRESS.md parsing (sections, counts)           |
| `packages/ralph/src/templates.ts`                | Mustache-style template rendering                |
| `packages/ralph/src/git.ts`                      | Git operations (branch, commit, push)            |
| `packages/ralph/src/display.ts`                  | Banner, status, list output with chalk           |
| `packages/ralph/src/phases.ts`                   | Phase state machine + transitions                |
| `packages/ralph/src/engine.ts`                   | Claude/Codex CLI execution + stream piping       |
| `packages/ralph/src/formatters/claude-stream.ts` | Claude stream-json parser                        |
| `packages/ralph/src/formatters/codex-stream.ts`  | Codex JSONL parser                               |
| `packages/ralph/src/cli.ts`                      | Argument parsing                                 |
| `packages/ralph/src/loop.ts`                     | Main iteration loop                              |
| `packages/ralph/src/index.ts`                    | Entry point (wires CLI + loop)                   |
| `packages/ralph/prompts/*.md`                    | Copied from src/bin/prompts/                     |
| `packages/ralph/templates/*.md`                  | Copied from src/bin/templates/                   |

## Files Modified

| File         | Change                                                 |
| ------------ | ------------------------------------------------------ |
| `.gitignore` | Add `node_modules/`, `dist/`, `bun.lock`               |
| `Makefile`   | Update install target to use built output from `dist/` |

## Files Removed

None in the initial conversion. The existing `src/bin/` shell scripts remain until the TS version is validated.

## Risks & Mitigations

| Risk                                         | Mitigation                                                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Bun stream compat with `claude` CLI          | Test early in Section 2 with a manual spawn; fall back to Node child_process if needed               |
| Static file resolution when installed vs dev | Use `import.meta.dir` for Bun; add runtime path resolution helper                                    |
| State.json backward compat                   | Zod schema uses `.default()` and `.optional()` for new fields; `migrate_state()` port handles legacy |
| Nx version churn                             | Pin exact versions in package.json                                                                   |

## Open Questions

- Should the old `src/bin/` shell scripts be removed in this task or a follow-up? (Plan assumes: keep them, remove later)
- Should we add a `bun run ralph` alias in root package.json scripts? (Plan assumes: yes)
