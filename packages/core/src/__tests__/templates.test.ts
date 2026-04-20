import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  renderTemplate,
  resolveTemplatePath,
  scaffoldTaskDocuments,
  scaffoldTasksDir,
} from "../templates";
import { runWithContext, createDefaultContext } from "@ralphy/context";
import type { StorageProvider } from "@ralphy/context";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import { resolveTasksDir, resolveScaffoldsDir } from "@ralphy/content";

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

const withStorage = <T>(fn: () => T): T => runWithContext(createDefaultContext(), fn);
let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "templates-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("scaffoldTaskDocuments", () => {
  test("copies scaffold templates to task directory", () =>
    withStorage(async () => {
      await scaffoldTaskDocuments(tempDir);
      // STEERING.md should be scaffolded (it has scaffold: "STEERING")
      expect(existsSync(join(tempDir, "STEERING.md"))).toBe(true);
      const content = readFileSync(join(tempDir, "STEERING.md"), "utf-8");
      expect(content.length).toBeGreaterThan(0);
    }));

  test("does not overwrite existing files", () =>
    withStorage(async () => {
      writeFileSync(join(tempDir, "STEERING.md"), "custom content", "utf-8");
      await scaffoldTaskDocuments(tempDir);
      const content = readFileSync(join(tempDir, "STEERING.md"), "utf-8");
      expect(content).toBe("custom content");
    }));

  test("uses fallbackContent when template file is missing", async () => {
    // Create a storage provider that returns null for scaffold template reads
    // but delegates everything else to the real filesystem
    const realCtx = createDefaultContext();
    const scaffoldsDir = resolveScaffoldsDir();
    const stubStorage: StorageProvider = {
      read(path: string): string | null {
        // Return null for scaffold templates to trigger fallbackContent
        if (path.startsWith(scaffoldsDir)) return null;
        return realCtx.storage.read(path);
      },
      write(path: string, content: string): void {
        realCtx.storage.write(path, content);
      },
      remove(path: string): void {
        realCtx.storage.remove(path);
      },
      list(prefix: string): string[] {
        return realCtx.storage.list(prefix);
      },
    };

    await runWithContext({ storage: stubStorage }, async () => {
      await scaffoldTaskDocuments(tempDir);
      // STEERING.md has fallbackContent defined, so it should use that
      expect(existsSync(join(tempDir, "STEERING.md"))).toBe(true);
      const content = readFileSync(join(tempDir, "STEERING.md"), "utf-8");
      expect(content).toContain("Steering");
    });
  });
});

describe("scaffoldTasksDir", () => {
  test("copies files from content/tasks/ to target directory", () =>
    withStorage(async () => {
      await scaffoldTasksDir(tempDir);
      // The tasks dir has a .gitignore
      const tasksDir = resolveTasksDir();
      if (existsSync(tasksDir)) {
        // Verify it copied what's available
        const gitignoreSrc = join(tasksDir, ".gitignore");
        if (existsSync(gitignoreSrc)) {
          expect(existsSync(join(tempDir, ".gitignore"))).toBe(true);
        }
      }
    }));

  test("does not overwrite existing files", () =>
    withStorage(async () => {
      writeFileSync(join(tempDir, ".gitignore"), "custom", "utf-8");
      await scaffoldTasksDir(tempDir);
      const content = readFileSync(join(tempDir, ".gitignore"), "utf-8");
      expect(content).toBe("custom");
    }));

  test("handles missing template directory gracefully", () =>
    withStorage(async () => {
      // Create a temp dir that doesn't have the expected template subdirs
      const nonExistentDir = join(tempDir, "nonexistent");
      // scaffoldTasksDir catches readdir failure and returns early
      await expect(scaffoldTasksDir(nonExistentDir)).resolves.toBeUndefined();
    }));
});
