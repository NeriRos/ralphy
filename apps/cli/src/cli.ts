import { readFileSync } from "node:fs";
import { log } from "@ralphy/output";
import type { Engine, Mode } from "@ralphy/types";

import HELP_TEXT from "./help.txt" with { type: "text" };

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

const VALID_MODES = new Set<string>(["task", "list", "status", "advance", "set-phase", "init"]);

const VALID_MODELS = new Set<string>(["haiku", "sonnet", "opus"]);

export function printHelp(): void {
  log(HELP_TEXT.trim());
}

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
  let expectModelFlag = false;
  let expectName = false;
  let expectPrompt = false;
  let expectPromptFile = false;
  let expectPhase = false;
  let expectDelay = false;
  let expectMaxCost = false;
  let expectMaxRuntime = false;
  let expectMaxFailures = false;
  let expectMaxIterations = false;
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

    if (expectModelFlag) {
      if (!VALID_MODELS.has(arg)) {
        throw new Error(`Invalid model '${arg}'. Valid models: ${[...VALID_MODELS].join(", ")}`);
      }
      result.model = arg;
      expectModelFlag = false;
      continue;
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
    if (expectMaxIterations) {
      result.maxIterations = parseInt(arg, 10);
      expectMaxIterations = false;
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
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
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
      case "--model":
        expectModelFlag = true;
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
      case "--max-iterations":
        expectMaxIterations = true;
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
        if (VALID_MODES.has(arg)) {
          result.mode = arg as Mode;
        } else {
          throw new Error(`Unknown argument '${arg}'\n\nRun 'ralph --help' for usage information.`);
        }
        break;
    }
  }

  return result;
}
