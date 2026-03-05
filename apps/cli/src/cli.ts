import { readFileSync } from "node:fs";
import type { Engine, Mode } from "@ralphy/types";

export interface ParsedArgs {
  mode: Mode;
  name: string;
  prompt: string;
  engine: Engine;
  model: string;
  engineSet: boolean;
  maxIterations: number;
  maxCostUsd: number;
  maxRuntimeMinutes: number;
  maxConsecutiveFailures: number;
  phase: string;
  noExecute: boolean;
  interactive: boolean;
  delay: number;
  log: boolean;
  verbose: boolean;
}

const VALID_MODES = new Set<string>(["task", "list", "status", "advance", "set-phase"]);

const VALID_MODELS = new Set<string>(["haiku", "sonnet", "opus"]);

/**
 * Parse CLI arguments, porting the shell `parse_args` logic.
 *
 * Supports:
 *   --name <name>           Task name
 *   --prompt <text>         Task description
 *   --prompt-file <path>    Read prompt from file
 *   --claude [model]        Use Claude engine (haiku|sonnet|opus)
 *   --codex                 Use Codex engine
 *   --phase <phase>         Target phase for set-phase mode
 *   --no-execute            Stop after research+plan
 *   --interactive           Run research+plan interactively, then continue automated
 *   --delay N               Seconds between iterations
 *   --log                   Log raw stream JSON
 *   --max-cost N            Stop when total cost exceeds $N (0 = no limit)
 *   --max-runtime N         Stop after N minutes of wall-clock time (0 = no limit)
 *   --max-failures N        Stop after N consecutive failures (default: 5, 0 = disable)
 *   --unlimited             Set max to 0 (unlimited, default)
 *   --timeout N             Deprecated (consumed and ignored)
 *   --push-interval N       Deprecated (consumed and ignored)
 *   [number]                Max iterations
 *   [mode]                  task|list|status|advance|set-phase
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    mode: "task",
    name: "",
    prompt: "",
    engine: "claude",
    model: "opus",
    engineSet: false,
    maxIterations: 0,
    maxCostUsd: 0,
    maxRuntimeMinutes: 0,
    maxConsecutiveFailures: 5,
    phase: "",
    noExecute: false,
    interactive: false,
    delay: 0,
    log: false,
    verbose: false,
  };

  let expectModel = false;
  let expectName = false;
  let expectPrompt = false;
  let expectPromptFile = false;
  let expectPhase = false;
  let expectDelay = false;
  let expectMaxCost = false;
  let expectMaxRuntime = false;
  let expectMaxFailures = false;
  let expectTimeout = false;
  let expectPushInterval = false;

  for (const arg of argv) {
    // Check if we're expecting a model argument after --claude
    if (expectModel) {
      if (VALID_MODELS.has(arg)) {
        result.model = arg;
        expectModel = false;
        continue;
      }
      // Not a valid model — fall through to process as a regular arg
      expectModel = false;
    }

    if (expectName) {
      result.name = arg;
      expectName = false;
      continue;
    }
    if (expectPrompt) {
      result.prompt = arg;
      expectPrompt = false;
      continue;
    }
    if (expectPromptFile) {
      result.prompt = readFileSync(arg, "utf-8");
      expectPromptFile = false;
      continue;
    }
    if (expectPhase) {
      result.phase = arg;
      expectPhase = false;
      continue;
    }
    if (expectDelay) {
      result.delay = parseInt(arg, 10);
      expectDelay = false;
      continue;
    }
    if (expectMaxCost) {
      result.maxCostUsd = parseFloat(arg);
      expectMaxCost = false;
      continue;
    }
    if (expectMaxRuntime) {
      result.maxRuntimeMinutes = parseFloat(arg);
      expectMaxRuntime = false;
      continue;
    }
    if (expectMaxFailures) {
      result.maxConsecutiveFailures = parseInt(arg, 10);
      expectMaxFailures = false;
      continue;
    }
    if (expectTimeout) {
      // Deprecated — consume and ignore
      expectTimeout = false;
      continue;
    }
    if (expectPushInterval) {
      // Deprecated — consume and ignore
      expectPushInterval = false;
      continue;
    }

    switch (arg) {
      case "--claude":
        if (result.engineSet && result.engine !== "claude") {
          throw new Error("Choose only one engine flag: --claude or --codex");
        }
        result.engine = "claude";
        result.engineSet = true;
        expectModel = true;
        break;
      case "--codex":
        if (result.engineSet && result.engine !== "codex") {
          throw new Error("Choose only one engine flag: --claude or --codex");
        }
        result.engine = "codex";
        result.engineSet = true;
        break;
      case "--name":
        expectName = true;
        break;
      case "--prompt":
        expectPrompt = true;
        break;
      case "--prompt-file":
        expectPromptFile = true;
        break;
      case "--phase":
        expectPhase = true;
        break;
      case "--no-execute":
        result.noExecute = true;
        break;
      case "--interactive":
        result.interactive = true;
        break;
      case "--delay":
        expectDelay = true;
        break;
      case "--max-cost":
        expectMaxCost = true;
        break;
      case "--max-runtime":
        expectMaxRuntime = true;
        break;
      case "--max-failures":
        expectMaxFailures = true;
        break;
      case "--timeout":
        expectTimeout = true;
        break;
      case "--push-interval":
        expectPushInterval = true;
        break;
      case "--unlimited":
        result.maxIterations = 0;
        break;
      case "--log":
        result.log = true;
        break;
      case "--verbose":
        result.verbose = true;
        break;
      default:
        // Check if it's a bare number (max iterations)
        if (/^\d+$/.test(arg)) {
          result.maxIterations = parseInt(arg, 10);
        } else if (VALID_MODES.has(arg)) {
          result.mode = arg as Mode;
        } else {
          throw new Error(`Unknown argument or mode '${arg}'`);
        }
        break;
    }
  }

  return result;
}
