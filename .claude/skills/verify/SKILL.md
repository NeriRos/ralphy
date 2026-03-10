---
name: verify
description: Run CI targets locally, push, and watch remote CI checks. Surfaces issues concisely. All output saved to /tmp.
user-invocable: true
argument-hint: [pr_number]
---

Run all CI verification steps. Save all output to `/tmp/verify-*` files.

## Step 1: Run local CI targets

Run each target sequentially. For each one, save stdout+stderr to a file under `/tmp/`. Stop early if a step fails — do NOT continue to subsequent steps after a failure.

```bash
bun run lint:ci 2>&1 | tee /tmp/<project-name>/verify-lint.log
bun run fmt:ci 2>&1 | tee /tmp/<project-name>/verify-fmt.log
bun run typecheck:ci 2>&1 | tee /tmp/<project-name>/verify-typecheck.log
bun run test:ci 2>&1 | tee /tmp/<project-name>/verify-test.log
bun run check:circular:ci 2>&1 | tee /tmp/<project-name>/verify-circular.log
```

After running all (or stopping on failure), read the log files and report a concise summary:

- Which steps passed / failed
- For failures: extract the key error lines (not the full log)

## Step 2: Push and watch remote CI

Only proceed to this step if ALL local steps passed.

1. Push the current branch:

   ```bash
   git push
   ```

2. Determine the PR number:
   - If `$ARGUMENTS` is provided, use it as the PR number
   - Otherwise, detect it:
     ```bash
     gh pr view --json number -q .number
     ```

3. Watch the CI checks, saving output:

   ```bash
   gh pr checks <pr_number> --watch 2>&1 | tee /tmp/<project-name>/verify-ci-checks.log
   ```

4. After checks complete, report a concise summary:
   - Which checks passed / failed
   - For failures: show the failing check name and any available error info

## Step 3: Final summary

Print a concise summary of all results:

- Local steps: pass/fail for each
- Remote CI: pass/fail for each check
- List all output files saved under `/tmp/<project-name>/verify-*.log`
- If there are any failures, surface the key issues clearly
