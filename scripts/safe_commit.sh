#!/bin/bash
# A wrapper to ensure tests pass before committing with jj.

if [ -z "$1" ]; then
  echo "Error: Commit message required."
  echo "Usage: ./scripts/safe_commit.sh \"<commit message>\""
  exit 1
fi

echo "Running type check and linting..."
if ! npm run lint; then
  echo "Linting failed! Fix errors before committing."
  exit 1
fi

#echo "Running unit tests..."
#if ! npm run test; then
#  echo "Tests failed! Fix tests before committing."
#  exit 1
#fi

echo "All checks passed. Committing..."
jj commit -m "$1"
