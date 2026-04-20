#!/usr/bin/env bun
/**
 * Single Component/Hook Per TSX File Check
 *
 * Enforces that each `.tsx` file exports at most one React component or custom hook.
 * Helper functions, constants, and types are fine — only PascalCase components and
 * `use*` hooks count toward the limit.
 *
 * Exemptions:
 *  - `.test.tsx` files are skipped entirely
 *  - `.context.tsx` files may export both a Provider component and a hook
 *    (they must contain `createContext`)
 *  - Non-`.tsx` files are not checked
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");

async function getReactScanDirs(): Promise<string[]> {
  const dirs = [join(REPO_ROOT, "apps", "ui", "src")];
  try {
    const packageDirs = await readdir(join(REPO_ROOT, "packages"), { withFileTypes: true });
    for (const entry of packageDirs) {
      if (!entry.isDirectory()) continue;
      const projectJsonPath = join(REPO_ROOT, "packages", entry.name, "project.json");
      try {
        const content = await Bun.file(projectJsonPath).text();
        const project = JSON.parse(content);
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

const EXPORTED_COMPONENT_OR_HOOK =
  /export\s+(?:default\s+)?(?:function|const)\s+([A-Z][A-Za-z\d]*|use[A-Z][A-Za-z\d]*)\b/g;

interface Violation {
  file: string;
  names: string[];
}

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) {
      yield full;
    }
  }
}

function findExportedComponentsAndHooks(source: string): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(EXPORTED_COMPONENT_OR_HOOK)) {
    const name = match[1];
    if (name) names.push(name);
  }
  return names;
}

function isContextFile(filePath: string, source: string): boolean {
  return filePath.endsWith(".context.tsx") && source.includes("createContext");
}

async function scanFile(filePath: string): Promise<Violation | null> {
  const source = await readFile(filePath, "utf8");
  if (isContextFile(filePath, source)) return null;

  const names = findExportedComponentsAndHooks(source);
  if (names.length <= 1) return null;

  return { file: relative(REPO_ROOT, filePath), names };
}

async function main(): Promise<void> {
  const violations: Violation[] = [];
  const SCAN_DIRS = await getReactScanDirs();

  for (const dir of SCAN_DIRS) {
    try {
      for await (const file of walk(dir)) {
        const result = await scanFile(file);
        if (result) violations.push(result);
      }
    } catch {
      // directory may not exist
    }
  }

  if (violations.length === 0) {
    console.log("✓ All .tsx files export at most one component/hook.");
    return;
  }

  console.error(`✘ Found ${violations.length} .tsx file(s) exporting multiple components/hooks:\n`);
  for (const { file, names } of violations) {
    console.error(`  ${file}`);
    console.error(`    Exports: ${names.join(", ")}\n`);
  }
  console.error(
    [
      "Each .tsx file should export a single React component or custom hook.",
      "Move additional components/hooks into their own .tsx files.",
      "Helper functions, constants, and types do not count — only PascalCase",
      "components and use* hooks are checked.",
      "",
      "*.context.tsx files with createContext are exempt (they may export a",
      "Provider + hook pair).",
    ].join("\n"),
  );
  process.exit(1);
}

await main();
