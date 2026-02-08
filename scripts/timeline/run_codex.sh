#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PLAYBOOK_PROVIDER="${PLAYBOOK_PROVIDER:-codex}"
PLAYBOOK_EXECUTE="${PLAYBOOK_EXECUTE:-true}"
if [[ -z "${PLAYBOOK_AGENT_CMD:-}" ]]; then
  PLAYBOOK_AGENT_CMD='bash scripts/timeline/provider_codex.sh {PROMPT_FILE} {OUTPUT_FILE}'
fi

export PLAYBOOK_PROVIDER
export PLAYBOOK_EXECUTE
export PLAYBOOK_AGENT_CMD

exec ./scripts/timeline/run.sh "$@"
