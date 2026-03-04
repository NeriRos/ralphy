import { resolve, dirname } from "node:path";
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
 * Resolve the absolute path to a template file by name (without extension).
 */
export function resolveTemplatePath(name: string): string {
  return resolve(packageRoot, "templates", "scaffolds", `${name}.md`);
}
