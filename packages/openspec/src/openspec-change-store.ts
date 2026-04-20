import { join } from "node:path";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import type { ChangeStore, ValidationResult } from "./change-store";

/**
 * OpenSpec-backed implementation of ChangeStore.
 * Shells out to `bunx openspec` for lifecycle operations,
 * and performs direct file I/O for document read/write.
 */
export class OpenSpecChangeStore implements ChangeStore {
  createChange(name: string, description: string): Promise<void> {
    const result = spawnSync(
      "bunx",
      ["openspec", "new", "change", name, "--description", description],
      { stdio: "inherit", encoding: "utf-8" },
    );
    if (result.status !== 0) {
      throw new Error(`openspec new change failed with exit code ${result.status ?? "unknown"}`);
    }
    return Promise.resolve();
  }

  getChangeDirectory(name: string): string {
    return join("openspec", "changes", name);
  }

  listChanges(): Promise<string[]> {
    const result = spawnSync("bunx", ["openspec", "list", "--json"], { encoding: "utf-8" });

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
    const path = join("openspec", "changes", name, "proposal.md");
    if (!existsSync(path)) {
      writeFileSync(path, `## Steering\n\n${message}\n`, "utf-8");
      return Promise.resolve();
    }

    const existing = readFileSync(path, "utf-8");
    const steeringHeader = "## Steering";

    if (existing.includes(steeringHeader)) {
      const steeringIndex = existing.indexOf(steeringHeader);
      const afterSteering = existing.slice(steeringIndex + steeringHeader.length);
      const nextSectionMatch = afterSteering.match(/\n## /);
      const insertionPoint = nextSectionMatch
        ? steeringIndex + steeringHeader.length + (nextSectionMatch.index ?? 0)
        : existing.length;

      const before = existing.slice(0, insertionPoint).trimEnd();
      const after = existing.slice(insertionPoint);
      writeFileSync(path, `${before}\n\n${message}\n${after}`, "utf-8");
    } else {
      const updated = existing.trimEnd() + `\n\n${steeringHeader}\n\n${message}\n`;
      writeFileSync(path, updated, "utf-8");
    }

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
    const result = spawnSync("bunx", ["openspec", "validate", name, "--json", "--no-interactive"], {
      encoding: "utf-8",
    });

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
