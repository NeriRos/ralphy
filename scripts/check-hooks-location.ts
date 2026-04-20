#!/usr/bin/env bun
/**
 * Hook Location Check
 *
 * Custom React hooks defined in `apps/ui/src/` MUST live in files named `useSomething.ts`
 * (or `useSomething.tsx`). Defining hooks inline in component files makes them hard to
 * discover, test, and reuse.
 *
 * To intentionally allow a hook in a non-hook file, add `// hooks-ignore` on the same
 * line or on a comment line directly above.
 */

import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");

async function getReactScanDirs(): Promise<string[]> {
  const dirs = [join(REPO_ROOT, "apps", "ui", "src")];
  try {
    const packageDirs = await readdir(join(REPO_ROOT, "packages"), { withFileTypes: true });
    for (const entry of packageDirs) {
      if (!entry.isDirectory()) continue;
      const projectJsonPath = join(REPO_ROOT, "packages", entry.name, "project.json");
      try {
        const projectJson = await Bun.file(projectJsonPath).text();
        const project = JSON.parse(projectJson);
        const tags: string[] = project.tags ?? [];
        if (tags.some((t) => t.includes("react"))) {
          const sourceRoot = project.sourceRoot ?? `packages/${entry.name}/src`;
          dirs.push(join(REPO_ROOT, sourceRoot));
        }
      } catch {
        // no project.json or not parseable
      }
    }
  } catch {
    // packages dir may not exist
  }
  return dirs;
}

interface Violation {
  file: string;
  line: number;
  text: string;
  hookName: string;
}

const HOOK_DEF = /(?:function\s+(use[A-Z]\w*)\s*\(|(?:const|let)\s+(use[A-Z]\w*)\s*=)/;

const IGNORE_MARKER = "hooks-ignore";

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

function isHookFile(filePath: string): boolean {
  const name = basename(filePath);
  return /^use[A-Z]/.test(name);
}

async function scanFile(filePath: string): Promise<Violation[]> {
  if (isHookFile(filePath)) return [];

  const source = await readFile(filePath, "utf8");
  const lines = source.split("\n");
  const violations: Violation[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (isIgnored(lines, i)) continue;
    const match = HOOK_DEF.exec(line);
    if (match) {
      const hookName = match[1] ?? match[2] ?? "unknown";
      violations.push({
        file: relative(REPO_ROOT, filePath),
        line: i + 1,
        text: line.trim(),
        hookName,
      });
    }
  }
  return violations;
}

async function main(): Promise<void> {
  const violations: Violation[] = [];
  const scanDirs = await getReactScanDirs();
  for (const dir of scanDirs) {
    try {
      for await (const file of walk(dir)) {
        violations.push(...(await scanFile(file)));
      }
    } catch {
      // directory may not exist
    }
  }

  if (violations.length === 0) {
    console.log("✓ All hooks in React source dirs live in useSomething.ts files");
    return;
  }

  console.error(`✘ Found ${violations.length} hook(s) defined outside useSomething.ts files:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.text}`);
    console.error(`    → Move \`${v.hookName}\` to its own \`${v.hookName}.ts\` file\n`);
  }
  console.error("Custom hooks must be defined in files named useSomething.ts (or .tsx).");
  console.error("If a hook intentionally belongs inline, add `// hooks-ignore` above it.");
  process.exit(1);
}

await main();
