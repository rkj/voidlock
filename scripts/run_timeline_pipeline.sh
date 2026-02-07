#!/usr/bin/env bash
set -euo pipefail

MANIFEST="${MANIFEST:-timeline/manifest.json}"
NAV_MAP="${NAV_MAP:-timeline/navigation_map.json}"
SCREENSHOTS="${SCREENSHOTS:-screenshots}"
FRAME_INDEX="${FRAME_INDEX:-timeline/frame_index.json}"
OUTPUT="${OUTPUT:-timeline/voidlock_timeline_full.mp4}"
PORT="${1:-${PORT:-6080}}"
MAX_COUNT="${MAX_COUNT:-0}"
MODE="${MODE:-all}"

echo "[timeline] manifest"
npm run timeline:manifest -- --manifest "$MANIFEST" --mode "$MODE" --max-count "$MAX_COUNT"

echo "[timeline] analyze navigation"
npm run timeline:analyze -- --manifest "$MANIFEST" --navigation-map "$NAV_MAP" --max-count "$MAX_COUNT"

echo "[timeline] capture screenshots"
npm run timeline:capture -- --manifest "$MANIFEST" --screenshots "$SCREENSHOTS" --port "$PORT" --max-count "$MAX_COUNT" --navigation-map "$NAV_MAP"

echo "[timeline] analyze frames"
npm run timeline:analyze-frames -- --manifest "$MANIFEST" --screenshots "$SCREENSHOTS" --frame-index "$FRAME_INDEX"

echo "[timeline] render video"
npm run timeline:render -- --frame-index "$FRAME_INDEX" --output "$OUTPUT"

echo "[timeline] done: $OUTPUT"
