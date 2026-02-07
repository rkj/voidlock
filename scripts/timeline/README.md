# Timeline Scripts

This folder contains the autonomous timeline pipeline.

## Runner

Use the one-command runner:

```bash
npm run timeline:run
# equivalent
./scripts/timeline/run.sh
```

Port is optional and defaults to `6080`:

```bash
./scripts/timeline/run.sh 6080
```

## Pipeline Stages

1. `timeline_manifest.ts`
2. `analyze_timeline_navigation.ts`
3. `analyze_screen_topology_changes.ts`
4. `plan_navigation_playbooks.ts`
5. `capture_timeline.ts`
6. `analyze_timeline_frames.ts`
7. `render_timeline.ts`

## Defaults

- `--max-count 0` means all commits / all manifest rows.
- Capture default port: `6080`.
- Playbook planner default provider: `heuristic`.
- `--agent-cmd` default: **none**.

If no `--agent-cmd` (or `PLAYBOOK_AGENT_CMD`) is provided, playbooks are generated heuristically and no external LLM is called.

## What "heuristic" Means

Heuristic mode uses static code analysis output to generate per-era navigation actions:
- Prefers direct DOM screen forcing (`show:#screen-*`) when screen containers exist.
- Falls back to click flow steps (`click:#btn-*`) when IDs suggest navigation buttons.
- Emits JSON playbooks in `timeline/navigation_playbooks.json`.

It is deterministic and local (no network model calls).

## External LLM Delegation (`--agent-cmd`)

`plan_navigation_playbooks.ts` can delegate each era prompt to an external command.

Your command must support these placeholders:
- `{PROMPT_FILE}`: input prompt text file
- `{OUTPUT_FILE}`: expected JSON output file

Example shape:

```bash
npm run timeline:playbooks -- \
  --topology timeline/screen_topology_changes.json \
  --navigation-map timeline/navigation_map.json \
  --playbooks timeline/navigation_playbooks.json \
  --provider gemini \
  --execute true \
  --agent-cmd "<your-command> {PROMPT_FILE} {OUTPUT_FILE}"
```

### Example: Gemini CLI wrapper

```bash
--agent-cmd "bash scripts/timeline/provider_gemini.sh {PROMPT_FILE} {OUTPUT_FILE}"
```

### Example: Claude CLI wrapper

```bash
--agent-cmd "bash scripts/timeline/provider_claude.sh {PROMPT_FILE} {OUTPUT_FILE}"
```

### Example: Codex wrapper

```bash
--agent-cmd "bash scripts/timeline/provider_codex.sh {PROMPT_FILE} {OUTPUT_FILE}"
```

Note: those wrapper scripts are not generated automatically; add whichever provider integration you want.

## Key Outputs

- `timeline/manifest.json`
- `timeline/navigation_map.json`
- `timeline/screen_topology_changes.json`
- `timeline/navigation_playbooks.json`
- `screenshots/*.png`
- `timeline/frames/quadrants/<datetime>_<sha>_<1|2|3|4>.png`
- `timeline/frames/composite/<datetime>_<sha>.png`
- `timeline/frame_index.json`
- `timeline/voidlock_timeline_full.mp4`
