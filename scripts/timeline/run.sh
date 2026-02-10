#!/usr/bin/env bash
set -euo pipefail

MANIFEST="${MANIFEST:-timeline/manifest.json}"
NAV_MAP="${NAV_MAP:-timeline/navigation_map.json}"
TOPOLOGY="${TOPOLOGY:-timeline/screen_topology_changes.json}"
PLAYBOOKS="${PLAYBOOKS:-timeline/navigation_playbooks.json}"
COMMIT_PLAYBOOKS="${COMMIT_PLAYBOOKS:-timeline/commit_playbooks.jsonl}"
SCREENSHOTS="${SCREENSHOTS:-screenshots}"
FRAME_INDEX="${FRAME_INDEX:-timeline/frame_index.json}"
OUTPUT="${OUTPUT:-timeline/voidlock_timeline_full.mp4}"
PORT="${1:-${PORT:-6080}}"
MAX_COUNT="${MAX_COUNT:-0}"
MODE="${MODE:-all}"
SAMPLE_EVERY="${SAMPLE_EVERY:-1}"
SAMPLE_OFFSET="${SAMPLE_OFFSET:-0}"
PLAYBOOK_PROVIDER="${PLAYBOOK_PROVIDER:-heuristic}"
PLAYBOOK_EXECUTE="${PLAYBOOK_EXECUTE:-false}"
PLAYBOOK_AGENT_CMD="${PLAYBOOK_AGENT_CMD:-}"
REUSE_PLAYBOOKS="${REUSE_PLAYBOOKS:-false}"
RESTART_EVERY="${RESTART_EVERY:-1}"
POST_LOAD_WAIT_MS="${POST_LOAD_WAIT_MS:-3000}"
MISSION_CAPTURE_WAIT_MS="${MISSION_CAPTURE_WAIT_MS:-3000}"
MISSION_SETTLE_MS="${MISSION_SETTLE_MS:-0}"
STARTUP_TIMEOUT_MS="${STARTUP_TIMEOUT_MS:-30000}"
MAX_CONSECUTIVE_FAILURES="${MAX_CONSECUTIVE_FAILURES:-3}"
CAPTURE_DEBUG_LOG="${CAPTURE_DEBUG_LOG:-timeline/capture_debug.json}"
MISSION_ALLOWLIST="${MISSION_ALLOWLIST:-timeline/mission_allowlist.txt}"
MISSION_REQUIRED="${MISSION_REQUIRED:-true}"

echo "[timeline] manifest"
npm run timeline:manifest -- --manifest "$MANIFEST" --mode "$MODE" --max-count "$MAX_COUNT" --sample-every "$SAMPLE_EVERY" --sample-offset "$SAMPLE_OFFSET"

echo "[timeline] analyze navigation"
npm run timeline:analyze -- --manifest "$MANIFEST" --navigation-map "$NAV_MAP" --max-count "$MAX_COUNT"

echo "[timeline] analyze topology changes"
npm run timeline:topology -- --manifest "$MANIFEST" --navigation-map "$NAV_MAP" --topology "$TOPOLOGY"

if [[ "$REUSE_PLAYBOOKS" == "true" ]]; then
  echo "[timeline] reuse existing playbooks and compile per-commit DB"
  npm run timeline:compile-playbooks -- --manifest "$MANIFEST" --playbooks "$PLAYBOOKS" --commit-playbooks-jsonl "$COMMIT_PLAYBOOKS"
else
  echo "[timeline] plan navigation playbooks"
  if [[ -n "$PLAYBOOK_AGENT_CMD" ]]; then
    TIMELINE_AGENT_CMD="$PLAYBOOK_AGENT_CMD" npm run timeline:playbooks -- --manifest "$MANIFEST" --topology "$TOPOLOGY" --navigation-map "$NAV_MAP" --playbooks "$PLAYBOOKS" --commit-playbooks-jsonl "$COMMIT_PLAYBOOKS" --provider "$PLAYBOOK_PROVIDER" --execute "$PLAYBOOK_EXECUTE"
  else
    npm run timeline:playbooks -- --manifest "$MANIFEST" --topology "$TOPOLOGY" --navigation-map "$NAV_MAP" --playbooks "$PLAYBOOKS" --commit-playbooks-jsonl "$COMMIT_PLAYBOOKS" --provider "$PLAYBOOK_PROVIDER" --execute "$PLAYBOOK_EXECUTE"
  fi
fi

echo "[timeline] capture screenshots"
npm run timeline:capture -- --manifest "$MANIFEST" --screenshots "$SCREENSHOTS" --port "$PORT" --max-count "$MAX_COUNT" --navigation-map "$NAV_MAP" --playbooks "$PLAYBOOKS" --commit-playbooks-jsonl "$COMMIT_PLAYBOOKS" --restart-every "$RESTART_EVERY" --post-load-wait-ms "$POST_LOAD_WAIT_MS" --mission-capture-wait-ms "$MISSION_CAPTURE_WAIT_MS" --mission-settle-ms "$MISSION_SETTLE_MS" --startup-timeout-ms "$STARTUP_TIMEOUT_MS" --max-consecutive-failures "$MAX_CONSECUTIVE_FAILURES" --debug-log "$CAPTURE_DEBUG_LOG" --mission-allowlist "$MISSION_ALLOWLIST" --mission-required "$MISSION_REQUIRED"

echo "[timeline] analyze frames"
npm run timeline:analyze-frames -- --manifest "$MANIFEST" --screenshots "$SCREENSHOTS" --frame-index "$FRAME_INDEX"

echo "[timeline] render video"
npm run timeline:render -- --frame-index "$FRAME_INDEX" --output "$OUTPUT"

echo "[timeline] done: $OUTPUT"
