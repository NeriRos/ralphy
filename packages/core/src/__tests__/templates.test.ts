import { describe, expect, test } from "bun:test";
import { renderTemplate, resolveTemplatePath } from "../templates";

describe("renderTemplate", () => {
  test("replaces single variable", () => {
    expect(renderTemplate("Hello {{NAME}}", { NAME: "world" })).toBe("Hello world");
  });

  test("replaces multiple variables", () => {
    const result = renderTemplate("{{A}} and {{B}}", { A: "x", B: "y" });
    expect(result).toBe("x and y");
  });

  test("replaces all occurrences of the same variable", () => {
    const result = renderTemplate("{{X}}-{{X}}", { X: "v" });
    expect(result).toBe("v-v");
  });

  test("leaves unmatched placeholders intact", () => {
    const result = renderTemplate("{{A}} {{B}}", { A: "yes" });
    expect(result).toBe("yes {{B}}");
  });

  test("handles empty vars", () => {
    expect(renderTemplate("no vars here", {})).toBe("no vars here");
  });
});

describe("resolveTemplatePath", () => {
  test("returns a path ending with scaffolds/<name>.md", () => {
    const path = resolveTemplatePath("STEERING");
    expect(path).toMatch(/scaffolds\/STEERING\.md$/);
  });
});
