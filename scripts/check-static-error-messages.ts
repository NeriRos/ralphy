#!/usr/bin/env bun
/**
 * Static Error Message Check
 *
 * Error constructors (`new SomeError(...)`, `new SomeException(...)`) MUST receive static string
 * literals as their first argument. Template literals that interpolate variables produce messages
 * that vary at runtime, which makes errors hard to search for in logs and monitoring dashboards.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");

interface Violation {
  file: string;
  line: number;
  text: string;
}

const DYNAMIC_ERROR_CONSTRUCTOR = /new\s+\w*(?:Error|Exception)\s*\(\s*`[^`]*\$\{/;

const EXCLUDED_DIRS = new Set(["node_modules", "dist", ".git", "scripts", "e2e"]);

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      yield full;
    }
  }
}

async function scanFile(filePath: string): Promise<Violation[]> {
  const source = await readFile(filePath, "utf8");
  const lines = source.split("\n");
  const violations: Violation[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    if (DYNAMIC_ERROR_CONSTRUCTOR.test(line)) {
      violations.push({ file: relative(REPO_ROOT, filePath), line: i + 1, text: trimmed });
    }
  }
  return violations;
}

async function main(): Promise<void> {
  const violations: Violation[] = [];
  for await (const file of walk(REPO_ROOT)) {
    if (file.includes("generated")) continue;
    violations.push(...(await scanFile(file)));
  }

  if (violations.length === 0) {
    console.log("✓ All error constructors use static messages");
    return;
  }

  console.error(`✘ Found ${violations.length} error constructor(s) with dynamic message(s):\n`);
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line}`);
    console.error(`    ${violation.text}\n`);
  }
  console.error(
    "Error messages must be static strings so they are searchable in logs and monitoring.",
  );
  console.error(
    "Move dynamic values into a separate field (e.g. context object) rather than the message.",
  );
  process.exit(1);
}

await main();
