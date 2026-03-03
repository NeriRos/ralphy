/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "mcp-no-engine",
      severity: "error",
      comment: "MCP app must not import the engine package (scope:cli only)",
      from: { path: "^apps/mcp" },
      to: { path: "^packages/engine" },
    },
    {
      name: "no-circular",
      severity: "error",
      comment: "No circular dependencies allowed",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "no-orphans",
      severity: "warn",
      comment: "Modules should be reachable from an entry point",
      from: {
        orphan: true,
        pathNot: ["(^|/)\\.[^/]+", "\\.d\\.ts$", "\\.test\\.ts$", "\\.spec\\.ts$"],
      },
      to: {},
    },
    {
      name: "no-test-imports-in-prod",
      severity: "error",
      comment: "Production code should not import test files",
      from: {
        pathNot: "\\.test\\.ts$|\\.spec\\.ts$",
      },
      to: {
        path: "\\.test\\.ts$|\\.spec\\.ts$",
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.base.json",
    },
  },
};
