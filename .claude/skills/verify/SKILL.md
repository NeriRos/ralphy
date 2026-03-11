---
name: verify
description: Run CI targets locally, push, and watch remote CI checks. Surfaces issues concisely. All output saved to /tmp.
user-invocable: true
argument-hint: [pr_number]
---

Run all CI verification steps. Save all output to `/tmp/<project-name>/<branch-name>/verify-*` files where `<project-name>` is from the root `package.json` `name` field and `<branch-name>` is the current git branch.

## Step 1: Read CI workflow and project info

1. Read `package.json` to get the project name.
2. Get the current branch name: `git branch --show-current`
3. Create the output directory: `mkdir -p /tmp/<project-name>/<branch-name>`
4. Read `.github/workflows/ci.yml` to extract the list of `run:` steps (after the install step). These are the local CI targets to execute. This ensures the skill always stays in sync with the actual CI pipeline.

## Step 2: Run local CI targets

Run ALL `run:` steps extracted from the workflow (skipping `bun install`) **in parallel** using the Bash tool. Each step saves stdout+stderr to `/tmp/<project-name>/<branch-name>/verify-<step-name>.log` (derive `<step-name>` from the step's `name:` field, lowercased and hyphenated, e.g. "Circular deps" -> "circular-deps").

Launch all steps at the same time — do NOT run them sequentially.

After all complete, read the log files for any that failed and report a concise summary:

- Which steps passed / failed
- For failures: extract the key error lines (not the full log)

## Step 3: Push and watch remote CI

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
   gh pr checks <pr_number> --watch 2>&1 | tee /tmp/<project-name>/<branch-name>/verify-ci-checks.log
   ```

4. After checks complete, report a concise summary:
   - Which checks passed / failed
   - For failures: show the failing check name and any available error info

## Step 4: Final summary

Print a concise summary of all results:

- Local steps: pass/fail for each
- Remote CI: pass/fail for each check
- List all output files saved under `/tmp/<project-name>/<branch-name>/verify-*.log`
- If there are any failures, surface the key issues clearly
