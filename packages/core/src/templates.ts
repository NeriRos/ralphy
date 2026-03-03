import { resolve, dirname } from "node:path";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
 * Resolve the absolute path to a prompt file by name (without extension).
 */
export function resolvePromptPath(name: string): string {
  return resolve(packageRoot, "prompts", `${name}.md`);
}

/**
 * Resolve the absolute path to a template file by name (without extension).
 */
export function resolveTemplatePath(name: string): string {
  return resolve(packageRoot, "templates", `${name}.md`);
}

/**
 * Resolve the absolute path to the templates/checklists/ directory.
 */
export function resolveChecklistDir(): string {
  return resolve(packageRoot, "templates", "checklists");
}

/**
 * List available checklist names (without .md extension).
 */
export function listChecklists(): string[] {
  const dir = resolveChecklistDir();
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}
