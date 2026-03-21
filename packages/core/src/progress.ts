export interface ProgressCount {
  checked: number;
  unchecked: number;
  total: number;
}

/**
 * Find the first section (## heading) that contains unchecked items (`- [ ]`).
 * Returns the section header and its body, or null if no such section exists.
 *
 * Finds the first unchecked section in PROGRESS.md.
 */
export function extractCurrentSection(content: string): string | null {
  const lines = content.split("\n");
  let sectionHeader = "";
  let buf = "";
  let hasUnchecked = false;
  let inSection = false;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      // New section boundary — check if previous section qualifies
      if (inSection && hasUnchecked) {
        return sectionHeader + "\n" + buf;
      }
      sectionHeader = line;
      buf = "";
      hasUnchecked = false;
      inSection = true;
      continue;
    }

    if (inSection) {
      buf += line + "\n";
      if (line.startsWith("- [ ]")) {
        hasUnchecked = true;
      }
    }
  }

  // Handle last section
  if (inSection && hasUnchecked) {
    return sectionHeader + "\n" + buf;
  }

  return null;
}

/**
 * Count checked and unchecked items in a PROGRESS.md file.
 */
export function countProgress(content: string): ProgressCount {
  const checked = (content.match(/^- \[x\]/gm) ?? []).length;
  const unchecked = (content.match(/^- \[ \]/gm) ?? []).length;
  return { checked, unchecked, total: checked + unchecked };
}

export interface ProgressItem {
  text: string;
  checked: boolean;
  section: string;
}

/**
 * Parse PROGRESS.md into individual items with section context.
 */
export function parseProgressItems(content: string): ProgressItem[] {
  const items: ProgressItem[] = [];
  let currentSection = "";

  for (const line of content.split("\n")) {
    if (line.startsWith("## ")) {
      currentSection = line.replace(/^## /, "").trim();
      continue;
    }
    const checkedMatch = line.match(/^- \[x\] (.+)/);
    if (checkedMatch) {
      items.push({ text: checkedMatch[1]!, checked: true, section: currentSection });
      continue;
    }
    const uncheckedMatch = line.match(/^- \[ \] (.+)/);
    if (uncheckedMatch) {
      items.push({ text: uncheckedMatch[1]!, checked: false, section: currentSection });
    }
  }

  return items;
}
