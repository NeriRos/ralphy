#!/usr/bin/env bash
set -euo pipefail

# Unsafe Cast Check
#
# Blocks all `as any` and `as unknown` casts in TypeScript source files.
# No ignore mechanism — every instance must be fixed with proper type narrowing,
# generics, or Zod parsing.

RESULTS=$(git grep -nE 'as (any|unknown)([^a-zA-Z0-9_]|$)' -- '*.ts' '*.tsx' ':!**/generated/**' 2>/dev/null || true)

if [ -z "$RESULTS" ]; then
  echo "✓ No \`as any\` or \`as unknown\` usage found"
  exit 0
fi

COUNT=$(echo "$RESULTS" | wc -l | tr -d ' ')
echo "✘ Found $COUNT unsafe cast(s):"
echo ""
echo "$RESULTS"
echo ""
echo "The \`as any\` and \`as unknown\` casts bypass TypeScript's type system and are forbidden."
echo "Fix each instance with proper type narrowing, generics, or Zod parsing."
echo "There is no ignore mechanism — every instance must be fixed."
exit 1
