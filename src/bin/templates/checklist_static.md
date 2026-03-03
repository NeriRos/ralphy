## Checklist — Static Analysis

Run these on affected code. Fix all errors before committing.

- [ ] **Lint** — run the project linter (see `CLAUDE.md` for command). Zero errors, zero warnings.
- [ ] **Typecheck** — run the type checker. Zero errors.
- [ ] **Build** — run a production build to catch anything lint/typecheck miss (import resolution, SSR issues, etc.).
- [ ] **Format** — run the formatter. Zero errors.
