/**
 * Domain interface for managing Ralphy changes.
 *
 * All code in apps/ and other packages/ should depend on this interface.
 * OpenSpec is the current implementation behind this abstraction —
 * swapping it out only requires a new implementation of ChangeStore.
 */

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export interface ChangeStore {
  /**
   * Create a new change with the given name and description.
   */
  createChange(name: string, description: string): Promise<void>;

  /**
   * Return the filesystem path to the change directory for the given name.
   */
  getChangeDirectory(name: string): string;

  /**
   * List the names of all active changes.
   */
  listChanges(): Promise<string[]>;

  /**
   * Read the task list document for the given change.
   */
  readTaskList(name: string): Promise<string>;

  /**
   * Write the task list document for the given change.
   */
  writeTaskList(name: string, content: string): Promise<void>;

  /**
   * Append a steering message to the proposal document for the given change.
   */
  appendSteering(name: string, message: string): Promise<void>;

  /**
   * Read a specific heading section from an artifact file (e.g. proposal.md).
   * Returns the content under the heading, up to the next same-or-higher-level heading.
   */
  readSection(name: string, artifact: string, heading: string): Promise<string>;

  /**
   * Validate the given change and return structured results.
   */
  validateChange(name: string): Promise<ValidationResult>;

  /**
   * Archive the given change once it is complete.
   */
  archiveChange(name: string): Promise<void>;
}
