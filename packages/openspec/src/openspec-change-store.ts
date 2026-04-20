import { join } from "node:path";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import type { ChangeStore, ValidationResult } from "@ralphy/change-store";

let runnerCache: "bunx" | "npx" | null = null;

function resolveRunner(): "bunx" | "npx" {
  if (runnerCache) return runnerCache;
  for (const candidate of ["bunx", "npx"] as const) {
    const probe = spawnSync(candidate, ["--version"], { encoding: "utf-8" });
    if (!probe.error) {
      runnerCache = candidate;
      return candidate;
    }
  }
  throw new Error(
    "ralph requires `bunx` or `npx` on PATH to run `openspec`. Install bun (https://bun.sh/) or Node.js and re-run.",
  );
}

function runBunx(
  args: string[],
  options: Omit<NonNullable<Parameters<typeof spawnSync>[2]>, "encoding"> = {},
): SpawnSyncReturns<string> {
  const runner = resolveRunner();
  return spawnSync(runner, args, { ...options, encoding: "utf-8" });
}

/**
 * OpenSpec-backed implementation of ChangeStore.
 * Shells out to `bunx openspec` for lifecycle operations,
 * and performs direct file I/O for document read/write.
 */
export class OpenSpecChangeStore implements ChangeStore {
  createChange(name: string, description: string): Promise<void> {
    const result = runBunx(["openspec", "new", "change", name, "--description", description], {
      stdio: "inherit",
    });
    if (result.status !== 0) {
      throw new Error(`openspec new change failed with exit code ${result.status ?? "unknown"}`);
    }
    return Promise.resolve();
  }

  getChangeDirectory(name: string): string {
    return join("openspec", "changes", name);
  }

  listChanges(): Promise<string[]> {
    const result = runBunx(["openspec", "list", "--json"]);

    if (result.stdout) {
      try {
        const parsed = JSON.parse(result.stdout) as { changes?: { name: string }[] } | string[];
        if (Array.isArray(parsed)) {
          return Promise.resolve(parsed.map((item) => String(item)));
        }
        if (parsed && typeof parsed === "object" && "changes" in parsed && parsed.changes) {
          return Promise.resolve(parsed.changes.map((change) => change.name));
        }
      } catch {
        // Fall through to directory scan
      }
    }

    // Fallback: scan the openspec/changes directory
    const changesDir = join("openspec", "changes");
    if (!existsSync(changesDir)) return Promise.resolve([]);
    const names = readdirSync(changesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    return Promise.resolve(names);
  }

  readTaskList(name: string): Promise<string> {
    const path = join("openspec", "changes", name, "tasks.md");
    if (!existsSync(path)) return Promise.resolve("");
    return Promise.resolve(readFileSync(path, "utf-8"));
  }

  writeTaskList(name: string, content: string): Promise<void> {
    const path = join("openspec", "changes", name, "tasks.md");
    writeFileSync(path, content, "utf-8");
    return Promise.resolve();
  }

  appendSteering(name: string, message: string): Promise<void> {
    const path = join("openspec", "changes", name, "steering.md");
    const existing = existsSync(path) ? readFileSync(path, "utf-8") : null;
    const updated = existing ? `${message}\n\n${existing.trimStart()}` : `${message}\n`;
    writeFileSync(path, updated, "utf-8");
    return Promise.resolve();
  }

  readSection(name: string, artifact: string, heading: string): Promise<string> {
    const path = join("openspec", "changes", name, artifact);
    if (!existsSync(path)) return Promise.resolve("");

    const content = readFileSync(path, "utf-8");
    const headingIndex = content.indexOf(heading);
    if (headingIndex === -1) return Promise.resolve("");

    const afterHeading = content.slice(headingIndex + heading.length);

    const levelMatch = heading.match(/^(#+)/);
    const level = levelMatch ? levelMatch[1]!.length : 2;
    const nextHeadingPattern = new RegExp(`\\n#{1,${level}} `);
    const nextMatch = afterHeading.match(nextHeadingPattern);

    const sectionContent = nextMatch ? afterHeading.slice(0, nextMatch.index) : afterHeading;
    return Promise.resolve(sectionContent.trim());
  }

  validateChange(name: string): Promise<ValidationResult> {
    const result = runBunx(["openspec", "validate", name, "--json", "--no-interactive"]);

    if (result.stdout) {
      try {
        const parsed = JSON.parse(result.stdout) as {
          valid?: boolean;
          warnings?: string[];
          errors?: string[];
        };
        return Promise.resolve({
          valid: parsed.valid ?? result.status === 0,
          warnings: parsed.warnings ?? [],
          errors: parsed.errors ?? [],
        });
      } catch {
        // Fall through to status-based result
      }
    }

    return Promise.resolve({
      valid: result.status === 0,
      warnings: [],
      errors: result.stderr ? [result.stderr] : [],
    });
  }

  archiveChange(name: string): Promise<void> {
    const result = spawnSync("bunx", ["openspec", "archive", name, "-y", "--skip-specs"], {
      stdio: "inherit",
      encoding: "utf-8",
    });
    if (result.status !== 0) {
      throw new Error(`openspec archive failed with exit code ${result.status ?? "unknown"}`);
    }
    return Promise.resolve();
  }
}
