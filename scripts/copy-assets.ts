import { cpSync, rmSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const content = resolve(root, "packages/content");

const dirs = ["phases", "checklists", "scaffolds"] as const;

for (const dir of dirs) {
  const target = resolve(dist, dir);
  rmSync(target, { recursive: true, force: true });
  cpSync(resolve(content, dir), target, { recursive: true });
}

mkdirSync(resolve(dist, "tasks"), { recursive: true });

console.log("Copied content assets to dist/");
