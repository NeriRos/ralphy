import { cp, rm, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const content = resolve(root, "packages/content");

const dirs = ["phases", "checklists", "scaffolds"] as const;

for (const dir of dirs) {
  const target = resolve(dist, dir);
  await rm(target, { recursive: true, force: true });
  await cp(resolve(content, dir), target, { recursive: true });
}

await mkdir(resolve(dist, "tasks"), { recursive: true });

// eslint-disable-next-line no-console -- build script status line
console.log("Copied content assets to dist/");
