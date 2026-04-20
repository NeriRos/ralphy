#!/usr/bin/env bun
/**
 * Direct-HTTP Check
 *
 * Frontend code under `apps/ui/src/` MUST NOT import `axios` directly.
 * Use the native fetch API or a typed wrapper instead.
 *
 * To intentionally allow a single line, add `// http-ignore` on the same line
 * or the line immediately above.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");
const UI_SRC = join(REPO_ROOT, "apps", "ui", "src");

interface Violation {
  file: string;
  line: number;
  text: string;
  reason: string;
}

const PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  {
    regex: /from\s+["']axios["']/,
    reason: "do not import axios directly — use the native fetch API",
  },
];

const IGNORE_MARKER = "http-ignore";

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      yield full;
    }
  }
}

function isIgnored(lines: string[], idx: number): boolean {
  if (lines[idx]?.includes(IGNORE_MARKER)) return true;
  for (let i = idx - 1; i >= 0; i -= 1) {
    const trimmed = lines[i]?.trim() ?? "";
    if (trimmed.startsWith("//")) {
      if (trimmed.includes(IGNORE_MARKER)) return true;
      continue;
    }
    break;
  }
  return false;
}

async function scanFile(filePath: string): Promise<Violation[]> {
  const source = await readFile(filePath, "utf8");
  const lines = source.split("\n");
  const violations: Violation[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (isIgnored(lines, i)) continue;
    for (const { regex, reason } of PATTERNS) {
      if (regex.test(line)) {
        violations.push({
          file: relative(REPO_ROOT, filePath),
          line: i + 1,
          text: line.trim(),
          reason,
        });
        break;
      }
    }
  }
  return violations;
}

async function main(): Promise<void> {
  const violations: Violation[] = [];
  try {
    for await (const file of walk(UI_SRC)) {
      violations.push(...(await scanFile(file)));
    }
  } catch {
    console.log("✓ No apps/ui/src/ directory to scan");
    return;
  }

  if (violations.length === 0) {
    console.log("✓ No direct axios usage in apps/ui/src/");
    return;
  }

  console.error(`✘ Found ${violations.length} direct HTTP library usage(s) in apps/ui/src/:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.text}`);
    console.error(`    → ${v.reason}\n`);
  }
  console.error("If a call legitimately needs axios, add `// http-ignore` above it.");
  process.exit(1);
}

await main();
