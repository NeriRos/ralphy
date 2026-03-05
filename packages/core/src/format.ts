/**
 * Normalize a task name: trim, lowercase, replace spaces/underscores with
 * hyphens, collapse runs of hyphens, and strip leading/trailing hyphens.
 */
export function formatTaskName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}
