
## Checklist — Deployment

Run after pushing. Skip if no CI/CD is configured.

- [ ] **Check deployment status** — use Vercel MCP or CI dashboard to confirm the deploy succeeded.
- [ ] **Read build logs on failure** — identify the error, fix locally, re-run static + test checklists, commit, push again.
- [ ] **Smoke test the deployed URL** — verify the deployed version loads and the affected feature works.
