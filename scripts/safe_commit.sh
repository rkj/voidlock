#!/bin/bash
# A wrapper to ensure type checks, linting, and tests pass before committing with jj.

if [ -z "$1" ]; then
  echo "Error: Commit message required."
  echo "Usage: ./scripts/safe_commit.sh \"<commit message>\""
  exit 1
fi

echo "=== Step 1/3: Type checking (tsc --noEmit) ==="
if ! npm run lint; then
  echo "❌ Type check failed! Fix errors before committing."
  exit 1
fi

# echo "=== Step 2/3: ESLint (errors only) ==="
# if ! npx eslint src/ --quiet 2>/dev/null; then
#   echo "❌ ESLint errors found! Fix errors before committing."
#   echo "Run 'npm run lint:quality' for details."
#   exit 1
# fi

echo "=== Step 3/3: Unit tests ==="
if ! npm run test; then
  echo "❌ Tests failed! Fix tests before committing."
  exit 1
fi

echo "✅ All checks passed. Committing..."
jj commit -m "$1"
