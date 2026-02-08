#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PORT="${1:-${PORT:-6080}}"

if [[ ! -f timeline/navigation_playbooks.json ]]; then
  echo "Missing timeline/navigation_playbooks.json. Run scripts/timeline/run_epoch_validation.sh first." >&2
  exit 1
fi

echo "[full] deterministic full run using existing playbooks (no agent)"
REUSE_PLAYBOOKS=true \
PLAYBOOK_EXECUTE=false \
./scripts/timeline/run.sh "$PORT"
