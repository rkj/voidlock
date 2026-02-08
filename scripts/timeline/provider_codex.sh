#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <PROMPT_FILE> <OUTPUT_FILE>" >&2
  exit 1
fi

PROMPT_FILE="$1"
OUTPUT_FILE="$2"

CODEX_BIN="${CODEX_BIN:-/home/rkj/.npm-global/bin/codex}"
CODEX_MODEL="${CODEX_MODEL:-gpt-5-mini}"

if [[ ! -x "$CODEX_BIN" ]]; then
  echo "Codex binary not executable: $CODEX_BIN" >&2
  exit 1
fi

PROMPT_TEXT="$(cat "$PROMPT_FILE")"

# Enforce browser-first behavior by running outside the repo so source files are unavailable.
WORK_DIR="$(mktemp -d /tmp/timeline-codex-XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

CONSTRAINED_PROMPT="$(cat <<'EOF'
You must operate in browser-first mode.
- Do NOT inspect local source code or repository files.
- Do NOT propose or use DOM force-show/style hacks.
- Output only JSON that matches the requested schema.
EOF
)"

(
  cd "$WORK_DIR"
  "$CODEX_BIN" exec \
    --model "$CODEX_MODEL" \
    --skip-git-repo-check \
    "$CONSTRAINED_PROMPT"$'\n\n'"$PROMPT_TEXT" \
    --output-last-message "$OUTPUT_FILE"
)
