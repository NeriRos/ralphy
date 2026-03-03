import { AsyncLocalStorage } from "node:async_hooks";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { dirname } from "node:path";
import type { StorageProvider } from "@ralphy/types";

export type { StorageProvider } from "@ralphy/types";

class FileSystemProvider implements StorageProvider {
  read(path: string): string | null {
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf-8");
  }
  write(path: string, content: string): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf-8");
  }
  remove(path: string): void {
    if (!existsSync(path)) return;
    unlinkSync(path);
  }
  list(prefix: string): string[] {
    if (!existsSync(prefix)) return [];
    return readdirSync(prefix) as string[];
  }
}

export function createFileSystemProvider(): StorageProvider {
  return new FileSystemProvider();
}

export interface AppContext {
  storage: StorageProvider;
}

const contextStore = new AsyncLocalStorage<AppContext>();

/** Get the current AppContext from AsyncLocalStorage. Throws if not set. */
export function getContext(): AppContext {
  const ctx = contextStore.getStore();
  if (!ctx) throw new Error("No AppContext set. Call runWithContext() first.");
  return ctx;
}

/** Shorthand: get the storage provider from the current context. */
export function getStorage(): StorageProvider {
  return getContext().storage;
}

/** Run a function with the given AppContext in scope. */
export function runWithContext<T>(ctx: AppContext, fn: () => T): T {
  return contextStore.run(ctx, fn);
}

/** Create a default AppContext with FileSystemProvider. */
export function createDefaultContext(): AppContext {
  return { storage: createFileSystemProvider() };
}
