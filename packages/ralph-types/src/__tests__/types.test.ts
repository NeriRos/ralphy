import { describe, expect, test } from "bun:test";
import { StateSchema, UsageSchema, HistoryEntrySchema } from "../types";

describe("UsageSchema", () => {
  test("parses a full usage object", () => {
    const input = {
      total_cost_usd: 2.22,
      total_duration_ms: 550298,
      total_turns: 93,
      total_input_tokens: 161,
      total_output_tokens: 19808,
      total_cache_read_input_tokens: 2087788,
      total_cache_creation_input_tokens: 81925,
    };
    const result = UsageSchema.parse(input);
    expect(result).toEqual(input);
  });

  test("applies defaults for empty object", () => {
    const result = UsageSchema.parse({});
    expect(result.total_cost_usd).toBe(0);
    expect(result.total_turns).toBe(0);
  });
});

describe("HistoryEntrySchema", () => {
  test("parses a minimal history entry", () => {
    const input = {
      timestamp: "2026-03-03T16:10:35Z",
      phase: "research",
      iteration: 0,
      engine: "claude",
      model: "opus",
      result: "advance -> plan",
    };
    const result = HistoryEntrySchema.parse(input);
    expect(result.timestamp).toBe("2026-03-03T16:10:35Z");
    expect(result.usage).toBeUndefined();
  });

  test("parses a history entry with usage", () => {
    const input = {
      timestamp: "2026-03-03T16:10:47Z",
      startedAt: "2026-03-03T16:06:04Z",
      endedAt: "2026-03-03T16:10:47Z",
      phase: "plan",
      iteration: 1,
      engine: "claude",
      model: "opus",
      result: "success",
      usage: {
        cost_usd: 1.02,
        duration_ms: 282918,
        num_turns: 27,
      },
    };
    const result = HistoryEntrySchema.parse(input);
    expect(result.startedAt).toBe("2026-03-03T16:06:04Z");
    expect(result.usage?.cost_usd).toBe(1.02);
  });
});

describe("StateSchema", () => {
  test("parses a real state.json", () => {
    const input = {
      version: "1",
      name: "typescript",
      prompt: "Convert to typescript",
      phase: "exec",
      phaseIteration: 2,
      totalIterations: 3,
      createdAt: "2026-03-03T16:06:04Z",
      lastModified: "2026-03-03T16:15:20Z",
      engine: "claude",
      model: "opus",
      status: "active",
      usage: {
        total_cost_usd: 2.22,
        total_duration_ms: 550298,
        total_turns: 93,
        total_input_tokens: 161,
        total_output_tokens: 19808,
        total_cache_read_input_tokens: 2087788,
        total_cache_creation_input_tokens: 81925,
      },
      history: [
        {
          timestamp: "2026-03-03T16:10:35Z",
          phase: "research",
          iteration: 0,
          engine: "claude",
          model: "opus",
          result: "advance -> plan",
        },
      ],
      metadata: { branch: "main" },
    };
    const result = StateSchema.parse(input);
    expect(result.name).toBe("typescript");
    expect(result.history).toHaveLength(1);
    expect(result.metadata.branch).toBe("main");
  });

  test("applies defaults for minimal input", () => {
    const input = {
      name: "test-task",
      prompt: "do something",
      phase: "research",
      createdAt: "2026-01-01T00:00:00Z",
      lastModified: "2026-01-01T00:00:00Z",
    };
    const result = StateSchema.parse(input);
    expect(result.version).toBe("1");
    expect(result.engine).toBe("claude");
    expect(result.model).toBe("opus");
    expect(result.status).toBe("active");
    expect(result.phaseIteration).toBe(0);
    expect(result.totalIterations).toBe(0);
    expect(result.usage.total_cost_usd).toBe(0);
    expect(result.history).toEqual([]);
    expect(result.metadata).toEqual({});
  });

  test("rejects missing required fields", () => {
    expect(() => StateSchema.parse({})).toThrow();
    expect(() => StateSchema.parse({ name: "x" })).toThrow();
  });
});
