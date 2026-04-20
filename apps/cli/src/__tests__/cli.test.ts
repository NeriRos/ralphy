import { describe, expect, test, spyOn } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import { parseArgs, printHelp } from "../cli";

describe("parseArgs", () => {
  test("defaults to task mode with claude/opus", () => {
    const result = parseArgs([]);
    expect(result.mode).toBe("task");
    expect(result.engine).toBe("claude");
    expect(result.model).toBe("opus");
    expect(result.maxIterations).toBe(0);
    expect(result.log).toBe(false);
    expect(result.engineSet).toBe(false);
  });

  test("parses mode as first positional argument", () => {
    expect(parseArgs(["list"]).mode).toBe("list");
    expect(parseArgs(["status"]).mode).toBe("status");
    expect(parseArgs(["init"]).mode).toBe("init");
  });

  test("parses --name flag", () => {
    const result = parseArgs(["--name", "my-task"]);
    expect(result.name).toBe("my-task");
  });

  test("parses --prompt flag", () => {
    const result = parseArgs(["--prompt", "Add dark mode"]);
    expect(result.prompt).toBe("Add dark mode");
  });

  test("parses --prompt-file flag", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "cli-test-"));
    const promptFile = join(tempDir, "prompt.txt");
    writeFileSync(promptFile, "Task from file");
    try {
      const result = parseArgs(["--prompt-file", promptFile]);
      expect(result.prompt).toBe("Task from file");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("parses --claude without model (defaults to opus)", () => {
    const result = parseArgs(["--claude"]);
    expect(result.engine).toBe("claude");
    expect(result.model).toBe("opus");
    expect(result.engineSet).toBe(true);
  });

  test("parses --claude with model", () => {
    const result = parseArgs(["--claude", "sonnet"]);
    expect(result.engine).toBe("claude");
    expect(result.model).toBe("sonnet");
    expect(result.engineSet).toBe(true);
  });

  test("parses --claude haiku", () => {
    const result = parseArgs(["--claude", "haiku"]);
    expect(result.model).toBe("haiku");
  });

  test("parses --codex", () => {
    const result = parseArgs(["--codex"]);
    expect(result.engine).toBe("codex");
    expect(result.engineSet).toBe(true);
  });

  test("throws on conflicting engine flags", () => {
    expect(() => parseArgs(["--claude", "--codex"])).toThrow("Choose only one engine flag");
    expect(() => parseArgs(["--codex", "--claude"])).toThrow("Choose only one engine flag");
  });

  test("throws on bare number (use --max-iterations instead)", () => {
    expect(() => parseArgs(["20"])).toThrow("Unknown argument");
  });

  test("parses --max-iterations flag", () => {
    const result = parseArgs(["--max-iterations", "20"]);
    expect(result.maxIterations).toBe(20);
  });

  test("parses --log", () => {
    const result = parseArgs(["--log"]);
    expect(result.log).toBe(true);
  });

  test("parses --delay with value", () => {
    const result = parseArgs(["--delay", "5"]);
    expect(result.delay).toBe(5);
  });

  test("parses --unlimited as maxIterations 0", () => {
    const result = parseArgs(["--max-iterations", "10", "--unlimited"]);
    expect(result.maxIterations).toBe(0);
  });

  test("ignores deprecated --timeout flag", () => {
    const result = parseArgs(["--timeout", "300"]);
    expect(result.mode).toBe("task");
  });

  test("ignores deprecated --push-interval flag", () => {
    const result = parseArgs(["--push-interval", "5"]);
    expect(result.mode).toBe("task");
  });

  test("throws on unknown argument", () => {
    expect(() => parseArgs(["--bogus"])).toThrow("Unknown argument");
  });

  test("parses complex real-world command", () => {
    const result = parseArgs([
      "task",
      "--max-iterations",
      "20",
      "--name",
      "dark-mode",
      "--prompt",
      "Add dark/light mode toggle",
      "--claude",
      "sonnet",
      "--log",
    ]);
    expect(result.mode).toBe("task");
    expect(result.maxIterations).toBe(20);
    expect(result.name).toBe("dark-mode");
    expect(result.prompt).toBe("Add dark/light mode toggle");
    expect(result.engine).toBe("claude");
    expect(result.model).toBe("sonnet");
    expect(result.log).toBe(true);
  });

  test("--claude followed by non-model arg uses default model", () => {
    const result = parseArgs(["--claude", "--name", "test"]);
    expect(result.engine).toBe("claude");
    expect(result.model).toBe("opus");
    expect(result.name).toBe("test");
  });

  test("allows duplicate same-engine flags", () => {
    const result = parseArgs(["--claude", "--claude", "haiku"]);
    expect(result.engine).toBe("claude");
    expect(result.model).toBe("haiku");
  });

  test("parses --model flag", () => {
    const result = parseArgs(["--model", "sonnet"]);
    expect(result.model).toBe("sonnet");
  });

  test("parses --model haiku", () => {
    const result = parseArgs(["--model", "haiku"]);
    expect(result.model).toBe("haiku");
  });

  test("throws on invalid --model value", () => {
    expect(() => parseArgs(["--model", "gpt4"])).toThrow("Invalid model");
  });

  test("--model overrides --claude default", () => {
    const result = parseArgs(["--claude", "--model", "haiku"]);
    expect(result.engine).toBe("claude");
    expect(result.model).toBe("haiku");
  });

  test("parses --max-cost flag", () => {
    const result = parseArgs(["--max-cost", "5.50"]);
    expect(result.maxCostUsd).toBe(5.5);
  });

  test("parses --max-runtime flag", () => {
    const result = parseArgs(["--max-runtime", "30"]);
    expect(result.maxRuntimeMinutes).toBe(30);
  });

  test("parses --max-failures flag", () => {
    const result = parseArgs(["--max-failures", "3"]);
    expect(result.maxConsecutiveFailures).toBe(3);
  });

  test("parses --verbose flag", () => {
    const result = parseArgs(["--verbose"]);
    expect(result.verbose).toBe(true);
  });

  test("unknown argument error includes help hint", () => {
    expect(() => parseArgs(["--bogus"])).toThrow("ralph --help");
  });
});

describe("printHelp", () => {
  test("outputs usage text", () => {
    const logs: string[] = [];
    const spy = spyOn(console, "log").mockImplementation((msg: string) => {
      logs.push(msg);
    });
    try {
      printHelp();
    } finally {
      spy.mockRestore();
    }
    const output = logs.join("\n");
    expect(output).toContain("Usage: ralph");
    expect(output).toContain("--name");
    expect(output).toContain("--help");
    expect(output).toContain("Examples:");
  });
});
