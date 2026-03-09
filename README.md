# Ralphy

An iterative AI task execution framework. Ralphy orchestrates multi-phase autonomous work using Claude or Codex engines, with built-in state management, progress tracking, and cost safeguards.

## How It Works

Ralphy breaks down complex tasks into structured phases:

```mermaid
graph LR
    R[Research] --> P[Plan] --> E[Exec] --> V[Review] --> D[Done]
    V -->|issues found| E
```

Each phase runs in a loop — the engine iterates until the phase's completion criteria are met, then auto-advances to the next phase. A `STEERING.md` file lets you guide the agent mid-flight.

## Installation

```bash
bun install
make install            # Install to ./.ralph
make install ~           # Install to ~/.ralph
make install /path/to   # Install to /path/to/.ralph
```

This builds the CLI and MCP server, copies them to `.ralph/bin/`, sets up phase definitions and templates, configures `.mcp.json`, and adds a `ralph` script to `package.json`. The `.ralph/` directory is gitignored by default.

### Prerequisites

- [Bun](https://bun.sh)
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli) (for the Claude engine)
- `jq` (for installation)

## Usage

### Create and Run a Task

```bash
ralph task --name fix-auth --prompt "Fix the JWT validation bug" --claude opus --max-iterations 10
```

The engine defaults to Claude Opus.

### Interactive Mode

```bash
ralph task --name fix-auth --prompt "Fix the JWT validation bug" --interactive
```

Runs the research and plan phases interactively (with direct terminal I/O), then switches to automated execution for the remaining phases. Useful when you want to guide early discovery and let the agent execute autonomously.

### Resume a Task

```bash
ralph task --name fix-auth
```

If the task already exists, it resumes from where it left off.

### Check Status

```bash
ralph list                    # Table of all tasks
ralph status --name fix-auth  # Detailed view of one task
```

### Manual Phase Control

```bash
ralph advance --name fix-auth              # Advance to next phase
ralph set-phase --name fix-auth --phase exec  # Jump to a specific phase
```

## CLI Options

| Option                 | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `--name <name>`        | Task name (required for most commands)                   |
| `--prompt <text>`      | Task description                                         |
| `--prompt-file <path>` | Read prompt from a file                                  |
| `--claude [model]`     | Use Claude engine (haiku/sonnet/opus)                    |
| `--codex`              | Use Codex engine                                         |
| `--model <model>`      | Set model (haiku/sonnet/opus)                            |
| `--no-execute`         | Stop after research + plan phases                        |
| `--interactive`        | Run research + plan interactively, then automate         |
| `--max-iterations <N>` | Stop after N iterations (0 = unlimited)                  |
| `--max-cost <N>`       | Stop when cost exceeds $N                                |
| `--max-runtime <N>`    | Stop after N minutes                                     |
| `--max-failures <N>`   | Stop after N consecutive identical failures (default: 5) |
| `--unlimited`          | Set max iterations to 0 (unlimited, default)             |
| `--delay <N>`          | Seconds to wait between iterations                       |
| `--log`                | Log raw JSON stream output                               |
| `--verbose`            | Verbose output                                           |

## Phases

| Phase        | Purpose                                      | Output                   |
| ------------ | -------------------------------------------- | ------------------------ |
| **Research** | Study the codebase and gather context        | `RESEARCH.md`            |
| **Plan**     | Design the implementation approach           | `PLAN.md`, `PROGRESS.md` |
| **Exec**     | Implement items from the progress checklist  | Code changes             |
| **Review**   | Verify the work, loop back to exec if needed | Updated `PROGRESS.md`    |
| **Done**     | Terminal phase — task is complete            | —                        |

## Task Files

Each task lives in `.ralph/tasks/<name>/` and contains:

| File             | Purpose                                          |
| ---------------- | ------------------------------------------------ |
| `state.json`     | Task state, usage stats, and history             |
| `STEERING.md`    | Your guidance to the agent (editable anytime)    |
| `RESEARCH.md`    | Agent's research findings                        |
| `PLAN.md`        | Agent's implementation plan                      |
| `PROGRESS.md`    | Checklist tracking execution progress            |
| `INTERACTIVE.md` | Context saved from interactive session (if used) |
| `STOP`           | Create this file to signal the loop to stop      |

## MCP Server

Ralphy includes an MCP server that exposes task management tools to Claude agents. It's automatically configured during installation. Available tools:

- `ralph_list_tasks` — List tasks with status and progress
- `ralph_get_task` — Get task details
- `ralph_create_task` / `ralph_run_task` — Create and run tasks
- `ralph_read_document` — Read task documents
- `ralph_advance_phase` — Advance or set phase
- `ralph_update_steering` — Update STEERING.md
- `ralph_finish_interactive` — Complete interactive session and hand off to automated phases
- `ralph_list_checklists` / `ralph_apply_checklist` — Manage verification checklists

## Project Structure

```
ralphy/
├── apps/
│   ├── cli/          # CLI application
│   └── mcp/          # MCP server
├── packages/
│   ├── core/         # State management, loop, progress
│   ├── context/      # Storage abstraction
│   ├── engine/       # Claude/Codex engine spawning
│   ├── output/       # Terminal formatting
│   ├── phases/       # Phase definitions and checklists
│   └── types/        # Zod schemas and types
└── Makefile
```

## Development

```bash
bun install
bunx nx run-many -t lint,typecheck,test,build   # Run checks
bunx nx run cli:build                            # Build CLI only
```
