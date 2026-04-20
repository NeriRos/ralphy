export interface TaskDocument {
  /** File name, e.g. "STEERING.md" */
  name: string;
  /** Template name (without .md) in templates/scaffolds/. null = no scaffold. */
  scaffold: string | null;
  /** Fallback content if template is missing during scaffold. */
  fallbackContent?: string;
  /** If set, inject into prompt for these phases (empty array = never, "all" = always). */
  promptInjection: {
    phases: string[] | "all";
    header: string;
    /** Filter out markdown headers and empty lines, cap at maxLines. */
    filterHeaders: boolean;
    maxLines: number;
  } | null;
  /** Show in `ralph status` file checklist. */
  showInStatus: boolean;
}

const TASK_DOCUMENTS: TaskDocument[] = [
  {
    name: "spec.md",
    scaffold: null,
    promptInjection: {
      phases: ["exec", "review"],
      header: "Specification (requirements to satisfy)",
      filterHeaders: true,
      maxLines: 50,
    },
    showInStatus: true,
  },
  {
    name: "RESEARCH.md",
    scaffold: null,
    promptInjection: null,
    showInStatus: true,
  },
  {
    name: "PLAN.md",
    scaffold: null,
    promptInjection: null,
    showInStatus: true,
  },
  {
    name: "PROGRESS.md",
    scaffold: null,
    promptInjection: null,
    showInStatus: true,
  },
  {
    name: "STEERING.md",
    scaffold: "STEERING",
    fallbackContent:
      "# Steering — User Guidance\n\nThis file is for providing real-time guidance and constraints to the agent as iterations progress.\n\n**USER: Edit this file anytime** to steer the task. Changes take effect on the next iteration.\n\n---\n\n**Leave this file empty if no special guidance is needed.**\n",
    promptInjection: {
      phases: "all",
      header: "User Steering (READ FIRST)",
      filterHeaders: true,
      maxLines: 20,
    },
    showInStatus: false,
  },
  {
    name: "MANUAL_TESTING.md",
    scaffold: "MANUAL_TESTING",
    promptInjection: {
      phases: ["exec", "review"],
      header: "Manual Testing Instructions (READ & FOLLOW)",
      filterHeaders: true,
      maxLines: 20,
    },
    showInStatus: false,
  },
  {
    name: "INTERACTIVE.md",
    scaffold: null,
    promptInjection: {
      phases: "all",
      header: "Interactive Session Context (READ FIRST)",
      filterHeaders: false,
      maxLines: 0,
    },
    showInStatus: false,
  },
];

/** All task documents. */
export function getTaskDocuments(): readonly TaskDocument[] {
  return TASK_DOCUMENTS;
}

/** Document names that can be read via MCP (all of them). */
export function getDocumentNames(): string[] {
  return TASK_DOCUMENTS.map((d) => d.name);
}

/** Documents that have templates and should be scaffolded on task creation. */
export function getScaffoldDocuments(): TaskDocument[] {
  return TASK_DOCUMENTS.filter((d) => d.scaffold !== null);
}

/** Documents shown in the status display. */
export function getStatusDocuments(): TaskDocument[] {
  return TASK_DOCUMENTS.filter((d) => d.showInStatus);
}

/** Documents to inject into the prompt for a given phase. */
export function getPromptDocuments(phase: string): TaskDocument[] {
  return TASK_DOCUMENTS.filter((d) => {
    if (!d.promptInjection) return false;
    if (d.promptInjection.phases === "all") return true;
    return d.promptInjection.phases.includes(phase);
  });
}
