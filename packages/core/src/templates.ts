import { resolve, dirname, join } from "node:path";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getStorage } from "@ralphy/context";
import { getScaffoldDocuments } from "./documents";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");

/**
 * Replace all `{{KEY}}` placeholders in content with values from vars.
 */
export function renderTemplate(content: string, vars: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/**
 * Resolve the absolute path to a template file by name (without extension).
 */
export function resolveTemplatePath(name: string): string {
  return resolve(packageRoot, "templates", "scaffolds", `${name}.md`);
}

/**
 * Scaffold document templates into a task directory.
 * Uses the document registry to determine which files need scaffolding.
 * Only copies files that do not already exist in the target.
 */
export function scaffoldTaskDocuments(taskDir: string): void {
  const storage = getStorage();
  for (const doc of getScaffoldDocuments()) {
    const dest = join(taskDir, doc.name);
    if (storage.read(dest) !== null) continue;

    const tmpl = storage.read(resolveTemplatePath(doc.scaffold!));
    if (tmpl !== null) {
      storage.write(dest, tmpl);
    } else if (doc.fallbackContent) {
      storage.write(dest, doc.fallbackContent);
    }
  }
}

/**
 * Copy files from templates/tasks/ into the target tasks directory.
 * Only copies files that do not already exist in the target.
 */
export function scaffoldTasksDir(tasksDir: string): void {
  const templateDir = resolve(packageRoot, "templates", "tasks");
  if (!existsSync(templateDir)) return;

  const storage = getStorage();
  for (const file of readdirSync(templateDir)) {
    const dest = join(tasksDir, file);
    if (storage.read(dest) === null) {
      const content = readFileSync(join(templateDir, file), "utf-8");
      storage.write(dest, content);
    }
  }
}
