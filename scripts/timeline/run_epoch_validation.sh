#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PORT="${1:-${PORT:-6080}}"

MANIFEST="${MANIFEST:-timeline/manifest.json}"
NAV_MAP="${NAV_MAP:-timeline/navigation_map.json}"
TOPOLOGY="${TOPOLOGY:-timeline/screen_topology_changes.json}"
PLAYBOOKS="${PLAYBOOKS:-timeline/navigation_playbooks.json}"
COMMIT_PLAYBOOKS="${COMMIT_PLAYBOOKS:-timeline/commit_playbooks.jsonl}"
SCREENSHOTS="${SCREENSHOTS:-screenshots}"
ERA_MANIFEST="${ERA_MANIFEST:-/tmp/manifest_eras.json}"

echo "[epoch] reset outputs"
rm -rf timeline screenshots
mkdir -p timeline screenshots

echo "[epoch] manifest"
npm run timeline:manifest -- --manifest "$MANIFEST" --mode all --max-count 0

echo "[epoch] analyze navigation"
npm run timeline:analyze -- --manifest "$MANIFEST" --navigation-map "$NAV_MAP" --max-count 0

echo "[epoch] detect topology changes"
npm run timeline:topology -- --manifest "$MANIFEST" --navigation-map "$NAV_MAP" --topology "$TOPOLOGY"

echo "[epoch] plan playbooks via codex"
npm run timeline:playbooks -- \
  --manifest "$MANIFEST" \
  --topology "$TOPOLOGY" \
  --navigation-map "$NAV_MAP" \
  --playbooks "$PLAYBOOKS" \
  --commit-playbooks-jsonl "$COMMIT_PLAYBOOKS" \
  --provider codex \
  --execute true \
  --agent-cmd 'bash scripts/timeline/provider_codex.sh {PROMPT_FILE} {OUTPUT_FILE}'

prompt_count="$(find timeline/playbook_prompts -maxdepth 1 -type f -name 'era_*.txt' | wc -l | tr -d ' ')"
output_count="$(find timeline/playbook_outputs -maxdepth 1 -type f -name 'era_*.json' | wc -l | tr -d ' ')"
echo "[epoch] codex artifacts prompts=$prompt_count outputs=$output_count"
if [[ "$prompt_count" -gt 0 && "$output_count" -eq 0 ]]; then
  echo "[epoch] ERROR: playbook prompts were generated but no Codex outputs were written." >&2
  echo "[epoch] Check Codex auth/trust and rerun." >&2
  exit 1
fi

echo "[epoch] build era-only manifest"
npm run timeline:era-manifest -- --manifest "$MANIFEST" --topology "$TOPOLOGY" --out "$ERA_MANIFEST"

echo "[epoch] capture era checkpoints"
npm run timeline:capture -- \
  --manifest "$ERA_MANIFEST" \
  --screenshots "$SCREENSHOTS" \
  --port "$PORT" \
  --max-count 0 \
  --navigation-map "$NAV_MAP" \
  --playbooks "$PLAYBOOKS" \
  --commit-playbooks-jsonl "$COMMIT_PLAYBOOKS" \
  --restart-every 1 \
  --mission-required true \
  --mission-allowlist timeline/mission_allowlist.txt \
  --startup-timeout-ms 30000 \
  --post-load-wait-ms 3000 \
  --mission-capture-wait-ms 3000

echo "[epoch] done. Review screenshots/, then run scripts/timeline/run_full_capture.sh"
