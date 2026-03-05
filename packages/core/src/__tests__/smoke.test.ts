import { describe, expect, test } from "bun:test";
import { smokeTestPassed } from "../smoke";

describe("smokeTestPassed", () => {
  test("returns true", () => {
    expect(smokeTestPassed()).toBe(true);
  });
});
