#!/usr/bin/env bun
/**
 * Folder Size Check
 *
 * Ensures no directory under `apps/` or `packages/` contains more than a configurable
 * number of source files. Large directories are harder to navigate and usually signal
 * that a module should be split into sub-features.
 *
 * Only counts production source files (ts, tsx, js, jsx, mjs, mts) — ignores assets,
 * JSON fixtures, config files, generated code, and co-located test/spec files.
 */

import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");
const MAX_FILES = 10;

const SOURCE_EXT = /\.(?:ts|tsx|js|jsx|mjs|mts)$/;
const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|mts)$/;

const EXEMPT_PATTERNS = [
  /node_modules/,
  /(?:^|\/)dist(?:\/|$)/,
  /(?:^|\/)\.next(?:\/|$)/,
  /generated/,
  /__fixtures__/,
  /\.playwright/,
];

interface Violation {
  dir: string;
  count: number;
  files: string[];
}

function isExempt(dirPath: string): boolean {
  return EXEMPT_PATTERNS.some((pattern) => pattern.test(dirPath));
}

async function countSourceFiles(dir: string): Promise<{ count: number; files: string[] }> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && SOURCE_EXT.test(e.name) && !TEST_FILE.test(e.name))
    .map((e) => e.name);
  return { count: files.length, files };
}

async function* walkDirs(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  yield dir;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    if (isExempt(full)) continue;
    yield* walkDirs(full);
  }
}

async function main(): Promise<void> {
  const scanRoots = [join(REPO_ROOT, "apps"), join(REPO_ROOT, "packages")];
  const violations: Violation[] = [];

  for (const root of scanRoots) {
    try {
      for await (const dir of walkDirs(root)) {
        if (isExempt(dir)) continue;
        const { count, files } = await countSourceFiles(dir);
        if (count > MAX_FILES) {
          violations.push({ dir: relative(REPO_ROOT, dir), count, files });
        }
      }
    } catch {
      // directory may not exist
    }
  }

  if (violations.length === 0) {
    console.log(`✓ No directory exceeds ${MAX_FILES} source files`);
    return;
  }

  console.error(
    `✘ Found ${violations.length} directory(s) with more than ${MAX_FILES} source files:\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.dir}/ (${v.count} files)`);
    for (const f of v.files) {
      console.error(`    ${f}`);
    }
    console.error();
  }
  console.error("Split large directories into sub-features or move shared utilities to a library.");
  process.exit(1);
}

await main();
