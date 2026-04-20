#!/usr/bin/env bun
/**
 * Prop Drilling Check
 *
 * Flags props threaded through multiple React components without being read
 * ("prop drilling"). The usual fix is to lift the value into a zustand store
 * or compose smaller components closer to the consumer.
 *
 * Scans: apps/ui/src + all packages with a "react" tag in project.json.
 *
 * Opt out per component with `// prop-drill-ignore` on or directly above its signature.
 * Exit code 1 if violations found, 0 if clean.
 */

import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  type ComponentInfo,
  type FileInfo,
  parseFile,
  resolveRelativeImport,
} from "./prop-drilling-ast";

const REPO_ROOT = join(import.meta.dirname, "..");
const MAX_DRILL_DEPTH = 3;
const SKIP_DIRS = new Set(["node_modules", "dist", "generated"]);

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

interface Violation {
  file: string;
  line: number;
  component: string;
  prop: string;
  depth: number;
  chain: string[];
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (
      entry.name.endsWith(".tsx") &&
      !entry.name.endsWith(".test.tsx") &&
      !entry.name.endsWith(".spec.tsx")
    ) {
      yield full;
    }
  }
}

interface ResolvedChild {
  file: string;
  name: string;
}

interface ResolveArgs {
  fromFile: FileInfo;
  jsxName: string;
  fileIndex: Map<string, FileInfo>;
}

async function resolveChild(args: ResolveArgs): Promise<ResolvedChild | null> {
  if (args.fromFile.components.has(args.jsxName)) {
    return { file: args.fromFile.file, name: args.jsxName };
  }
  const importSource = args.fromFile.imports.get(args.jsxName);
  if (!importSource) return null;
  const resolvedPath = await resolveRelativeImport({
    fromFile: args.fromFile.file,
    source: importSource,
  });
  if (!resolvedPath) return null;
  const target = args.fileIndex.get(resolvedPath);
  if (!target || !target.components.has(args.jsxName)) return null;
  return { file: resolvedPath, name: args.jsxName };
}

interface DrillContext {
  fileIndex: Map<string, FileInfo>;
  memo: Map<string, number>;
  stack: Set<string>;
}

interface DrillArgs {
  component: ComponentInfo;
  prop: string;
  chain: string[];
  ctx: DrillContext;
}

interface DrillResult {
  depth: number;
  chain: string[];
}

function drillKey(component: ComponentInfo, prop: string): string {
  return `${component.file}#${component.name}#${prop}`;
}

async function drillThroughForwards(args: DrillArgs): Promise<DrillResult> {
  const fromFile = args.ctx.fileIndex.get(args.component.file);
  if (!fromFile) return { depth: 0, chain: args.chain };
  const forwards = args.component.propForwards.get(args.prop) ?? [];
  let best: DrillResult = { depth: 0, chain: args.chain };
  for (const fwd of forwards) {
    const resolved = await resolveChild({
      fromFile,
      jsxName: fwd.childJsxName,
      fileIndex: args.ctx.fileIndex,
    });
    if (!resolved) continue;
    const child = args.ctx.fileIndex.get(resolved.file)?.components.get(resolved.name);
    if (!child || !child.declaredProps.includes(fwd.asName)) continue;
    const next = await computeDrillDepth({
      component: child,
      prop: fwd.asName,
      chain: [...args.chain, `${relative(REPO_ROOT, resolved.file)}:${child.name}`],
      ctx: args.ctx,
    });
    const total = 1 + next.depth;
    if (total > best.depth) best = { depth: total, chain: next.chain };
  }
  return best;
}

function finalize(args: {
  key: string;
  depth: number;
  chain: string[];
  ctx: DrillContext;
}): DrillResult {
  args.ctx.stack.delete(args.key);
  args.ctx.memo.set(args.key, args.depth);
  return { depth: args.depth, chain: args.chain };
}

async function computeDrillDepth(args: DrillArgs): Promise<DrillResult> {
  const key = drillKey(args.component, args.prop);
  if (args.ctx.stack.has(key)) return { depth: 0, chain: args.chain };
  const cached = args.ctx.memo.get(key);
  if (cached !== undefined) return { depth: cached, chain: args.chain };
  args.ctx.stack.add(key);
  if (args.component.propReads.has(args.prop)) {
    return finalize({ key, depth: 0, chain: args.chain, ctx: args.ctx });
  }
  const forwards = args.component.propForwards.get(args.prop) ?? [];
  if (forwards.length === 0) {
    return finalize({ key, depth: 0, chain: args.chain, ctx: args.ctx });
  }
  const best = await drillThroughForwards(args);
  return finalize({ key, depth: best.depth, chain: best.chain, ctx: args.ctx });
}

async function collectFiles(scanDirs: string[]): Promise<string[]> {
  const files: string[] = [];
  for (const dir of scanDirs) {
    for await (const file of walk(dir)) files.push(file);
  }
  return files;
}

async function buildFileIndex(files: string[]): Promise<Map<string, FileInfo>> {
  const fileIndex = new Map<string, FileInfo>();
  for (const file of files) {
    const info = await parseFile(file);
    if (info) fileIndex.set(file, info);
  }
  return fileIndex;
}

interface CheckArgs {
  component: ComponentInfo;
  prop: string;
  ctx: DrillContext;
}

async function checkProp(args: CheckArgs): Promise<Violation | null> {
  if (args.component.propReads.has(args.prop)) return null;
  const forwards = args.component.propForwards.get(args.prop);
  if (!forwards || forwards.length === 0) return null;
  const seedChain = [`${relative(REPO_ROOT, args.component.file)}:${args.component.name}`];
  const { depth, chain } = await computeDrillDepth({
    component: args.component,
    prop: args.prop,
    chain: seedChain,
    ctx: args.ctx,
  });
  if (depth < MAX_DRILL_DEPTH) return null;
  return {
    file: relative(REPO_ROOT, args.component.file),
    line: args.component.signatureLine,
    component: args.component.name,
    prop: args.prop,
    depth,
    chain,
  };
}

async function findViolations(fileIndex: Map<string, FileInfo>): Promise<Violation[]> {
  const ctx: DrillContext = { fileIndex, memo: new Map(), stack: new Set() };
  const violations: Violation[] = [];
  for (const info of fileIndex.values()) {
    for (const component of info.components.values()) {
      if (component.ignored) continue;
      for (const prop of component.declaredProps) {
        const v = await checkProp({ component, prop, ctx });
        if (v) violations.push(v);
      }
    }
  }
  return violations;
}

function printViolation(v: Violation): void {
  console.error(`  ${v.file}:${v.line}  ${v.component} → prop "${v.prop}"`);
  console.error(`    drill depth: ${v.depth}`);
  console.error(`    chain: ${v.chain.join(" → ")}\n`);
}

function reportViolations(violations: Violation[]): void {
  if (violations.length === 0) {
    console.log(`✓ No props drilled through ≥ ${MAX_DRILL_DEPTH} layers without being read.`);
    return;
  }
  console.error(
    `✘ Found ${violations.length} prop(s) drilled through ≥ ${MAX_DRILL_DEPTH} layers:\n`,
  );
  for (const v of violations) printViolation(v);
  console.error(
    [
      "Props passed through several components without being read are a sign",
      "of prop drilling. Lift the value into a store or compose smaller",
      "components closer to the consumer instead.",
      "",
      "If a component must participate in this chain, add `// prop-drill-ignore`",
      "on or above its signature.",
    ].join("\n"),
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const scanDirs = await getReactScanDirs();
  const files = await collectFiles(scanDirs);
  const fileIndex = await buildFileIndex(files);
  const violations = await findViolations(fileIndex);
  reportViolations(violations);
}

await main();
