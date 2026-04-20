#!/usr/bin/env bun
/**
 * CI ↔ Local Sync Check
 *
 * Verifies that every actionable step in `.github/workflows/ci.yml` has a
 * matching `run_step "<name>"` entry in `scripts/ci-local.sh`.
 *
 * Steps that intentionally have no local equivalent must be annotated with
 * `# local-ci: skip` on the same line as the `- name:` directive.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");
const CI_YML = join(REPO_ROOT, ".github", "workflows", "ci.yml");
const CI_LOCAL = join(REPO_ROOT, "scripts", "ci-local.sh");

const SKIP_MARKER = /local-ci:\s*skip/i;
const STEP_NAME_RE = /^\s+-\s*name:\s*(.+?)$/;

function extractWorkflowStepNames(content: string): string[] {
  const names: string[] = [];

  for (const line of content.split("\n")) {
    const match = line.match(STEP_NAME_RE);
    if (!match) continue;

    if (SKIP_MARKER.test(line)) continue;

    let name = match[1].trim();
    name = name.replace(/^["']|["']$/g, "");
    name = name.replace(/\s*#(?!.*local-ci).*$/, "").trim();
    names.push(name);
  }

  return names;
}

function extractRunStepNames(content: string): Set<string> {
  const names = new Set<string>();
  for (const match of content.matchAll(/run_step\s+"([^"]+)"/g)) {
    names.add(match[1]);
  }
  return names;
}

const workflowContent = readFileSync(CI_YML, "utf-8");
const localContent = readFileSync(CI_LOCAL, "utf-8");

const requiredSteps = extractWorkflowStepNames(workflowContent);
const localSteps = extractRunStepNames(localContent);

const missing = requiredSteps.filter((name) => !localSteps.has(name));

if (missing.length > 0) {
  console.error("ci-local.sh is missing run_step entries for the following ci.yml steps:\n");
  for (const name of missing) {
    console.error(`  - "${name}"`);
  }
  console.error("\nEither add a matching run_step in scripts/ci-local.sh or mark the");
  console.error("step with `# local-ci: skip` in .github/workflows/ci.yml if it");
  console.error("intentionally has no local equivalent.");
  process.exit(1);
}

console.log(`All ${requiredSteps.length} required ci.yml steps are present in ci-local.sh.`);
