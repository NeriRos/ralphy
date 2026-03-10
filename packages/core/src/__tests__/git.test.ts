import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";

// We test git.ts by mocking child_process.execSync
const mockExecSync = mock(() => "");

mock.module("node:child_process", () => ({
  execSync: mockExecSync,
}));

// Import after mocking
const { getCurrentBranch, gitAdd, gitCommit, gitPush, commitState, commitTaskDir } =
  await import("../git");

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "git-test-"));
  mockExecSync.mockReset();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("getCurrentBranch", () => {
  test("returns trimmed branch name from git", () => {
    mockExecSync.mockReturnValue("feature/my-branch\n");
    const branch = getCurrentBranch();
    expect(branch).toBe("feature/my-branch");
    expect(mockExecSync).toHaveBeenCalledWith("git branch --show-current", {
      encoding: "utf-8",
    });
  });

  test("returns 'main' when git command fails", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not a git repo");
    });
    expect(getCurrentBranch()).toBe("main");
  });
});

describe("gitAdd", () => {
  test("calls execSync with quoted file paths", () => {
    mockExecSync.mockReturnValue("");
    gitAdd(["file1.ts", "file2.ts"]);
    expect(mockExecSync).toHaveBeenCalledWith('git add "file1.ts" "file2.ts"', { stdio: "pipe" });
  });

  test("handles a single file", () => {
    mockExecSync.mockReturnValue("");
    gitAdd(["src/index.ts"]);
    expect(mockExecSync).toHaveBeenCalledWith('git add "src/index.ts"', {
      stdio: "pipe",
    });
  });
});

describe("gitCommit", () => {
  test("calls execSync with escaped message", () => {
    mockExecSync.mockReturnValue("");
    gitCommit("fix: resolve issue");
    expect(mockExecSync).toHaveBeenCalledWith('git commit -m "fix: resolve issue"', {
      stdio: "pipe",
    });
  });

  test("escapes double quotes in message", () => {
    mockExecSync.mockReturnValue("");
    gitCommit('add "feature"');
    expect(mockExecSync).toHaveBeenCalledWith('git commit -m "add \\"feature\\""', {
      stdio: "pipe",
    });
  });
});

describe("gitPush", () => {
  test("succeeds on first attempt", () => {
    mockExecSync.mockReturnValue("");
    gitPush();
    expect(mockExecSync).toHaveBeenCalledTimes(2); // getCurrentBranch + push
  });

  test("falls back to push -u on first failure", () => {
    mockExecSync.mockImplementation((...args: unknown[]) => {
      const cmd = args[0] as string;
      if (cmd === "git branch --show-current") return "main\n";
      if (cmd === "git push") throw new Error("no upstream");
      return "";
    });
    gitPush();
    expect(mockExecSync).toHaveBeenCalledWith("git push -u origin main", {
      stdio: "pipe",
    });
  });

  test("falls back to --set-upstream on second failure", () => {
    mockExecSync.mockImplementation((...args: unknown[]) => {
      const cmd = args[0] as string;
      if (cmd === "git branch --show-current") return "dev\n";
      if (cmd === "git push") throw new Error("no upstream");
      if (cmd === "git push -u origin dev") throw new Error("no upstream");
      return "";
    });
    gitPush();
    expect(mockExecSync).toHaveBeenCalledWith("git push --set-upstream origin dev", {
      stdio: "pipe",
    });
  });

  test("silently skips when all push attempts fail", () => {
    mockExecSync.mockImplementation((...args: unknown[]) => {
      const cmd = args[0] as string;
      if (cmd === "git branch --show-current") return "main\n";
      throw new Error("no remote");
    });
    // Should not throw
    expect(() => gitPush()).not.toThrow();
  });
});

describe("commitState", () => {
  test("adds and commits state.json", () => {
    mockExecSync.mockReturnValue("");
    commitState("/tasks/test", "phase transition");
    expect(mockExecSync).toHaveBeenCalledWith('git add "/tasks/test/state.json"', {
      stdio: "pipe",
    });
    expect(mockExecSync).toHaveBeenCalledWith('git commit -m "docs(ralph): phase transition"', {
      stdio: "pipe",
    });
  });

  test("silently handles failure", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("nothing to commit");
    });
    expect(() => commitState("/tasks/test", "msg")).not.toThrow();
  });
});

describe("commitTaskDir", () => {
  test("adds task directory and commits with prefixed message", () => {
    mockExecSync.mockReturnValue("");
    commitTaskDir("/tasks/my-task", "save progress");
    expect(mockExecSync).toHaveBeenCalledWith('git add "/tasks/my-task"', {
      stdio: "pipe",
    });
    expect(mockExecSync).toHaveBeenCalledWith('git commit -m "docs(ralph): save progress"', {
      stdio: "pipe",
    });
  });

  test("silently handles failure", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("nothing to commit");
    });
    expect(() => commitTaskDir("/tasks/test", "msg")).not.toThrow();
  });
});
