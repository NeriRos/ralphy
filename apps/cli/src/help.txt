Usage: ralph <command> [options]

Commands:
  task                    Run a task (default)
  list                    List incomplete tasks
  status                  Show detailed task status
  advance                 Advance task to next phase
  set-phase               Set task to a specific phase
  init                    Initialize ralph in current directory

Options:
  --name <name>           Task name (required for most commands)
  --prompt <text>         Task description
  --prompt-file <path>    Read prompt from file
  --model <model>         Set model (haiku|sonnet|opus)
  --claude [model]        Use Claude engine (haiku|sonnet|opus, default: opus)
  --codex                 Use Codex engine
  --phase <phase>         Target phase (for set-phase)
  --no-execute            Stop after research + plan
  --interactive           Run research+plan interactively, then continue automated
  --delay <seconds>       Seconds between iterations
  --max-iterations <n>    Stop after N iterations (0 = unlimited)
  --max-cost <n>          Stop when total cost exceeds $N (0 = no limit)
  --max-runtime <n>       Stop after N minutes of wall-clock time (0 = no limit)
  --max-failures <n>      Stop after N consecutive failures (default: 5, 0 = disable)
  --unlimited             No iteration limit (default)
  --log                   Log raw engine stream
  --verbose               Verbose output
  --help, -h              Show this help message

Examples:
  ralph task --name my-feature --prompt "Add dark mode"
  ralph task --name my-feature --claude sonnet --max-iterations 10
  ralph list
  ralph status --name my-feature
  ralph advance --name my-feature
  ralph set-phase --name my-feature --phase exec
