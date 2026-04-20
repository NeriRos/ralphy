import { join } from "node:path";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

/**
 * Returns the path to a change directory relative to the project root.
 * OpenSpec stores changes under openspec/changes/<name>.
 */
export function changeDirectory(name: string): string {
  return join("openspec", "changes", name);
}

/**
 * Result type for openspec validate.
 */
export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Initialize a new change via `bunx openspec new change <name> --description "..."`.
 */
export async function initChange(name: string, description: string): Promise<void> {
  const result = spawnSync(
    "bunx",
    ["openspec", "new", "change", name, "--description", description],
    { stdio: "inherit", encoding: "utf-8" },
  );
  if (result.status !== 0) {
    throw new Error(`openspec new change failed with exit code ${result.status ?? "unknown"}`);
  }
}

/**
 * Validate a change via `bunx openspec validate <name> --json`.
 */
export async function validate(name: string): Promise<ValidationResult> {
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
      return {
        valid: parsed.valid ?? result.status === 0,
        warnings: parsed.warnings ?? [],
        errors: parsed.errors ?? [],
      };
    } catch {
      // Fall through to status-based result
    }
  }

  return {
    valid: result.status === 0,
    warnings: [],
    errors: result.stderr ? [result.stderr] : [],
  };
}

/**
 * Archive a completed change via `bunx openspec archive <name> -y --skip-specs`.
 */
export async function archive(name: string): Promise<void> {
  const result = spawnSync("bunx", ["openspec", "archive", name, "-y", "--skip-specs"], {
    stdio: "inherit",
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(`openspec archive failed with exit code ${result.status ?? "unknown"}`);
  }
}

/**
 * List all active changes via `bunx openspec list --json`.
 */
export async function listChanges(): Promise<string[]> {
  const result = spawnSync("bunx", ["openspec", "list", "--json"], { encoding: "utf-8" });

  if (result.stdout) {
    try {
      const parsed = JSON.parse(result.stdout) as { changes?: { name: string }[] } | string[];
      if (Array.isArray(parsed)) {
        return parsed.map((item) => (typeof item === "string" ? item : item.name));
      }
      if (parsed && typeof parsed === "object" && "changes" in parsed && parsed.changes) {
        return parsed.changes.map((change) => change.name);
      }
    } catch {
      // Fall through to directory scan
    }
  }

  // Fallback: scan the openspec/changes directory
  const changesDir = join("openspec", "changes");
  if (!existsSync(changesDir)) return [];
  return readdirSync(changesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/**
 * Read tasks.md for a change.
 */
export async function readTasks(name: string): Promise<string> {
  const path = join("openspec", "changes", name, "tasks.md");
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

/**
 * Write tasks.md for a change.
 */
export async function writeTasks(name: string, content: string): Promise<void> {
  const path = join("openspec", "changes", name, "tasks.md");
  writeFileSync(path, content, "utf-8");
}

/**
 * Append a steering message to the `## Steering` section in proposal.md.
 * If the section does not exist, it is appended at the end of the file.
 */
export async function appendSteering(name: string, message: string): Promise<void> {
  const path = join("openspec", "changes", name, "proposal.md");
  if (!existsSync(path)) {
    writeFileSync(path, `## Steering\n\n${message}\n`, "utf-8");
    return;
  }

  const existing = readFileSync(path, "utf-8");
  const steeringHeader = "## Steering";

  if (existing.includes(steeringHeader)) {
    // Append after the steering section content (before the next ## section or EOF)
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
}

/**
 * Read a specific heading section from an artifact file (e.g. proposal.md).
 * Returns the content under the heading, up to the next same-or-higher-level heading.
 */
export async function readSection(
  name: string,
  artifact: string,
  heading: string,
): Promise<string> {
  const path = join("openspec", "changes", name, artifact);
  if (!existsSync(path)) return "";

  const content = readFileSync(path, "utf-8");
  const headingIndex = content.indexOf(heading);
  if (headingIndex === -1) return "";

  const afterHeading = content.slice(headingIndex + heading.length);

  // Determine heading level (number of leading #)
  const levelMatch = heading.match(/^(#+)/);
  const level = levelMatch ? levelMatch[1]!.length : 2;
  const nextHeadingPattern = new RegExp(`\\n#{1,${level}} `);
  const nextMatch = afterHeading.match(nextHeadingPattern);

  const sectionContent = nextMatch ? afterHeading.slice(0, nextMatch.index) : afterHeading;

  return sectionContent.trim();
}
