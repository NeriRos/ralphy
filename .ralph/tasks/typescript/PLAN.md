# Plan: Convert ralphy to TypeScript + Nx + Bun

## Summary

Convert the ralphy shell-based task execution system into a TypeScript project using Nx as the build system and Bun as the package manager. The ~1700 lines of shell code (loop.sh + two formatters) decompose into ~12 TypeScript modules organized by domain.

## Approach

1. **Scaffold first** — Set up Nx workspace, tsconfig, package.json with Bun before writing any application code
2. **Types before logic** — Define Zod schemas and TypeScript types for state.json, phases, and config upfront
3. **Core modules bottom-up** — Port the dependency-free core modules (state, progress, template, phase) first
4. **CLI and display next** — Port argument parsing (using `commander`) and terminal output (using `picocolors`)
5. **Engine layer** — Port prompt builder and engine runner (subprocess spawning for claude/codex)
6. **Formatters** — Convert JSONL stream parsers from bash+jq to TypeScript
7. **Main loop last** — Wire everything together in index.ts
8. **Install mechanism** — Replace Makefile with an Nx build target + install script
9. **Preserve shell originals** — Keep `src/bin/` intact during conversion; new TS code lives in `src/` at the module level

## Key Architectural Decisions

- **Single-project Nx layout** — Not a monorepo. One `project.json` at root.
- **Bun as package manager only** — Use `@nx/js:node` for runtime execution (avoids Bun IPC issues with Nx)
- **Disable Nx TUI** — Known display issues with Bun; set `"tui": { "enabled": false }`
- **ESM throughout** — `"type": "module"` in package.json, ESM imports in all TS files
- **Assets as files, not imports** — Prompts and templates stay as markdown files in `assets/`, read at runtime via `import.meta.dirname`
- **Formatters in-process** — Instead of piping through separate formatter scripts, integrate formatter logic directly into the engine runner
- **Atomic writes** — Use write-to-temp-then-rename pattern for state.json updates (matching current shell behavior)

## Files Created/Modified

### New Files
| File | Purpose |
|---|---|
| `nx.json` | Nx workspace config |
| `package.json` | Dependencies, scripts, bin entry |
| `tsconfig.base.json` | Base TS config |
| `tsconfig.json` | Project TS config |
| `project.json` | Nx project targets (build, test, lint, typecheck) |
| `src/index.ts` | CLI entry point + main loop |
| `src/cli/args.ts` | Argument parsing with commander |
| `src/core/state.ts` | state.json CRUD + Zod schema |
| `src/core/phase.ts` | Phase state machine + transitions |
| `src/core/progress.ts` | PROGRESS.md parsing |
| `src/core/template.ts` | Template rendering + scaffolding |
| `src/engine/prompt.ts` | Prompt assembly |
| `src/engine/runner.ts` | Engine subprocess execution |
| `src/formatters/claude.ts` | Claude stream JSONL parser |
| `src/formatters/codex.ts` | Codex stream JSONL parser |
| `src/display/terminal.ts` | Banner, status, list display |
| `src/utils/git.ts` | Git helpers |
| `src/types.ts` | Shared types and Zod schemas |
| `assets/prompts/*.md` | Copied from src/bin/prompts/ |
| `assets/templates/*.md` | Copied from src/bin/templates/ |
| `assets/gitignore` | Copied from src/gitignore |
| `scripts/install.ts` | Replaces Makefile install target |
| `vitest.config.ts` | Test configuration |

### Preserved Files
- `src/bin/` — Shell originals kept for reference during conversion
- `skills-lock.json` — Unchanged
- `.claude/` — Unchanged

### Removed (after conversion verified)
- `Makefile` — Replaced by scripts/install.ts
- `src/bin/` — After all shell functionality is ported and tested

## Risks & Open Questions

1. **Bun + Nx compatibility** — Bun IPC limitations may cause issues. Mitigation: disable TUI, use Node.js runtime executor.
2. **Self-installation loop** — Building ralphy updates `dist/`, which is installed into `.ralph/`. Must ensure build doesn't trigger during its own execution.
3. **Backward compat** — Existing `.ralph/` installs in other projects expect shell scripts. The install script needs to fully replace the shell artifacts.
4. **Asset resolution** — `import.meta.dirname` works in ESM but path resolution needs testing when installed vs running from source.

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `nx` | ^21 | Build system |
| `@nx/js` | ^21 | TypeScript build/typecheck |
| `typescript` | ^5.7 | Language |
| `commander` | ^13 | CLI argument parsing |
| `picocolors` | ^1 | Terminal colors |
| `zod` | ^3 | Schema validation |
| `vitest` | ^3 | Testing |
