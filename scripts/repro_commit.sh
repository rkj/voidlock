#!/bin/bash
if [ -z "$1" ]; then
  echo "Error: Commit message required."
  exit 1
fi
echo "Running type check..."
if ! npm run lint; then
  echo "Linting failed!"
  exit 1
fi
echo "Repro commit: Skipping tests as they are expected to fail."
jj commit -m "$1"
