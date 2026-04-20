import { $ } from "bun";

const MAX_MINOR_DRIFT = 3;
const MIN_PACKAGE_LINE_PARTS = 3;
const COLUMN_WIDTH = 30;
const SEPARATOR_WIDTH = 120;

interface OutdatedEntry {
  name: string;
  current: string;
  latest: string;
}

function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function minorDrift(current: string, latest: string): number {
  const currentVersion = parseVersion(current);
  const latestVersion = parseVersion(latest);
  if (!currentVersion || !latestVersion) return 0;
  if (currentVersion.major !== latestVersion.major) return MAX_MINOR_DRIFT + 1;
  return latestVersion.minor - currentVersion.minor;
}

async function fetchOutdatedOutput(): Promise<string> {
  try {
    return (await $`bun outdated 2>&1`.text()).trim();
  } catch (err: unknown) {
    return String(
      err instanceof Error && "stdout" in err ? (err as { stdout: string }).stdout : err,
    );
  }
}

function parseOutdatedLines(output: string): OutdatedEntry[] {
  const lines = output.split("\n").filter((line) => line.includes("."));
  const outdated: OutdatedEntry[] = [];
  for (const line of lines) {
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length >= MIN_PACKAGE_LINE_PARTS) {
      const name = parts[0]!;
      const current = parts[1]!;
      const latest = parts[parts.length - 1]!;
      if (parseVersion(current) && parseVersion(latest)) {
        outdated.push({ name, current, latest });
      }
    }
  }
  return outdated;
}

function printViolationsTable(violations: OutdatedEntry[]): void {
  console.error(`\nDependencies more than ${MAX_MINOR_DRIFT} minor versions behind:\n`);
  console.error(
    ["Package", "Current", "Latest", "Drift"].map((header) => header.padEnd(COLUMN_WIDTH)).join(""),
  );
  console.error("-".repeat(SEPARATOR_WIDTH));
  for (const dep of violations) {
    const drift = minorDrift(dep.current, dep.latest);
    console.error(
      [dep.name, dep.current, dep.latest, `${drift} minors behind`]
        .map((val) => val.padEnd(COLUMN_WIDTH))
        .join(""),
    );
  }
  console.error(`\n${violations.length} package(s) need updating.`);
}

async function main(): Promise<void> {
  const output = await fetchOutdatedOutput();

  if (!output || output.includes("All dependencies are up to date")) {
    console.log("All dependencies are up to date.");
    process.exit(0);
  }

  const outdated = parseOutdatedLines(output);
  const violations = outdated.filter(
    (dep) => minorDrift(dep.current, dep.latest) > MAX_MINOR_DRIFT,
  );

  if (violations.length === 0) {
    console.log(
      `All ${outdated.length} dependencies are within ${MAX_MINOR_DRIFT} minor versions.`,
    );
    process.exit(0);
  }

  printViolationsTable(violations);
  process.exit(1);
}

await main();
