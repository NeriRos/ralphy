import { join } from "node:path";
import { readdir, stat } from "node:fs/promises";
import { getStorage } from "@ralphy/context";
import { resolveScaffoldsDir, resolveTasksDir } from "@ralphy/content";
import { getScaffoldDocuments } from "./documents";

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
  return join(resolveScaffoldsDir(), `${name}.md`);
}

/**
 * Scaffold document templates into a task directory.
 * Uses the document registry to determine which files need scaffolding.
 * Only copies files that do not already exist in the target.
 */
export async function scaffoldTaskDocuments(taskDir: string, prompt?: string): Promise<void> {
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

  // Seed spec.md with the user prompt if it doesn't exist yet
  if (prompt) {
    const specPath = join(taskDir, "spec.md");
    if (storage.read(specPath) === null) {
      storage.write(specPath, `> ${prompt}\n`);
    }
  }
}

/**
 * Copy files from content/tasks/ into the target tasks directory.
 * Only copies files that do not already exist in the target.
 */
export async function scaffoldTasksDir(tasksDir: string): Promise<void> {
  const templateDir = resolveTasksDir();
  if (!(await Bun.file(templateDir).exists())) {
    // Bun.file().exists() is file-focused; fall back by attempting readdir.
  }

  const storage = getStorage();
  let entries: string[];
  try {
    entries = await readdir(templateDir);
  } catch {
    return;
  }

  for (const file of entries) {
    const src = join(templateDir, file);
    const info = await stat(src);
    if (info.isDirectory()) continue;
    const dest = join(tasksDir, file);
    if (storage.read(dest) === null) {
      const content = await Bun.file(src).text();
      storage.write(dest, content);
    }
  }
}
