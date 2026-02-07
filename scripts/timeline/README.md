# Timeline Pipeline

This folder contains a 7-stage pipeline for generating an end-to-end development timeline video from git history.

Design goal:
- Capture from project inception to current `HEAD`.
- Support unstable UI evolution across commits.
- Separate data-generation stages from render stages.
- Make each stage testable and rerunnable independently.

## Stage Order

1. `timeline_manifest.ts`
2. `analyze_timeline_navigation.ts`
3. `analyze_screen_topology_changes.ts`
4. `plan_navigation_playbooks.ts`
5. `capture_timeline.ts`
6. `analyze_timeline_frames.ts`
7. `render_timeline.ts`

## Run Modes

Full pipeline:

```bash
npm run timeline:run
# equivalent
./scripts/timeline/run.sh
```

Default port is `6080` (override optional positional arg):

```bash
./scripts/timeline/run.sh 6100
```

Run individual stages:

```bash
npm run timeline:manifest -- --manifest timeline/manifest.json --mode all --max-count 0
npm run timeline:analyze -- --manifest timeline/manifest.json --navigation-map timeline/navigation_map.json --max-count 0
npm run timeline:topology -- --manifest timeline/manifest.json --navigation-map timeline/navigation_map.json --topology timeline/screen_topology_changes.json
npm run timeline:playbooks -- --topology timeline/screen_topology_changes.json --navigation-map timeline/navigation_map.json --playbooks timeline/navigation_playbooks.json --provider heuristic --execute false
npm run timeline:capture -- --manifest timeline/manifest.json --screenshots screenshots --port 6080 --max-count 0 --navigation-map timeline/navigation_map.json --playbooks timeline/navigation_playbooks.json
npm run timeline:analyze-frames -- --manifest timeline/manifest.json --screenshots screenshots --frame-index timeline/frame_index.json
npm run timeline:render -- --frame-index timeline/frame_index.json --output timeline/voidlock_timeline_full.mp4
```

## Stage Contracts

### 1) `timeline_manifest.ts`

Purpose:
- Enumerate commits from git log and write milestone rows for downstream processing.

Inputs:
- Git history.

Outputs:
- `timeline/manifest.json`.

Arguments:
- `--manifest` or `--out` (default `timeline/manifest.json`)
- `--mode` (`all` or `visual`, default `all`)
- `--max-count` (`0` means unlimited/all)
- `--min-hours` (used by milestone selection logic, default `8`)

Notes:
- `--mode all` currently writes all commits (subject to `--max-count`).
- `--mode visual` applies visual-commit filtering + milestone selection heuristics.

### 2) `analyze_timeline_navigation.ts`

Purpose:
- For each manifest commit, inspect HTML/code in a git worktree and infer screen/action IDs.

Inputs:
- `timeline/manifest.json`

Outputs:
- `timeline/navigation_map.json`

Arguments:
- `--manifest` (default `timeline/manifest.json`)
- `--navigation-map` or `--out` (default `timeline/navigation_map.json`)
- `--max-count` (`0` means all manifest rows)

Implementation details:
- Uses `.timeline/worktrees/analyzer`.
- Extracts `id="..."` from HTML and `btn-*` literals from selected code files.
- Produces `targets` for canonical screen names: `mission`, `main_menu`, `config`, `campaign`.

### 3) `analyze_screen_topology_changes.ts`

Purpose:
- Convert per-commit nav IDs into topology change events and eras.

Inputs:
- `timeline/manifest.json`
- `timeline/navigation_map.json`

Outputs:
- `timeline/screen_topology_changes.json`

Arguments:
- `--manifest` (default `timeline/manifest.json`)
- `--navigation-map` (default `timeline/navigation_map.json`)
- `--topology` or `--out` (default `timeline/screen_topology_changes.json`)

### 4) `plan_navigation_playbooks.ts`

Purpose:
- Generate per-era navigation plans (playbooks) for capture stage.

Inputs:
- `timeline/screen_topology_changes.json`
- `timeline/navigation_map.json`

Outputs:
- `timeline/navigation_playbooks.json`
- `timeline/playbook_prompts/*.txt`
- Optional `timeline/playbook_outputs/*.json` (when external agent is executed)

Arguments:
- `--topology` (default `timeline/screen_topology_changes.json`)
- `--navigation-map` (default `timeline/navigation_map.json`)
- `--playbooks` or `--out` (default `timeline/navigation_playbooks.json`)
- `--provider` (default `heuristic`)
- `--execute` (`true|false`, default `false`)
- `--agent-cmd` (or env `TIMELINE_AGENT_CMD`)

Heuristic mode:
- Deterministic/local playbook generation.
- Uses `show:#screen-*` where possible.
- Falls back to `click:#btn-*` steps where IDs exist.

External agent mode:
- Command must accept placeholders `{PROMPT_FILE}` and `{OUTPUT_FILE}`.
- Expected output JSON keys: `strategy`, `notes`, `actions`.

### 5) `capture_timeline.ts`

Purpose:
- Checkout each commit, run Vite, navigate with Puppeteer, and write raw screenshots.

Inputs:
- `timeline/manifest.json`
- Optional `timeline/navigation_map.json`
- Optional `timeline/navigation_playbooks.json`

Outputs:
- `screenshots/<stamp>_<screen>_<sha7>.png`
- Manifest rows updated with `captureStatus`, `captureReason`, `actualCommitUsed`

Arguments:
- `--manifest` (default `timeline/manifest.json`)
- `--screenshots` (default `screenshots`)
- `--port` (default `6080`)
- `--max-count` (`0` means all)
- `--navigation-map` (default `timeline/navigation_map.json`)
- `--playbooks` (default `timeline/navigation_playbooks.json`)
- `--worktree-base` (default `.timeline/worktrees`)
- `--startup-timeout-ms` (default `12000`)
- `--max-consecutive-failures` (default `3`)
- `--restart-every` rotate server every N successful commits (default `100`, `0` disables cadence rotation)
- `--post-load-wait-ms` delay before capture/bootstrap clicks (default `3000`)
- `--mission-capture-wait-ms` extra settle delay before mission screenshot (default `3000`)
- `--debug-log` (default `timeline/capture_debug.json`)

Capture targets and quadrants:
- `1`: `mission`
- `2`: `main_menu`
- `3`: `config`
- `4`: `campaign`

Health checks:
- Deterministic startup protocol:
- start/reuse server for commit
- wait for port
- probe `GET /` and require healthy HTML (`200`, non-error)
- only then start browser capture from `/`
- run bootstrap click flow (custom mission/start/deploy ids when present) after post-load wait
- By default, the server is reused for speed and rotated every `100` commits (configurable via `--restart-every`).
- On per-commit failure, the server is restarted and retried once before marking commit `skipped`.
- Logs `[candidate-fail]` and marks commit `skipped`.
- If no target screen can be activated on a healthy page, falls back to a full-page `mission` screenshot so the commit is still represented.
- Aborts the run after N consecutive failures and writes JSON diagnostics to `--debug-log`.

### 6) `analyze_timeline_frames.ts`

Purpose:
- Convert raw screenshots into normalized quadrant images + composite frames.
- Deduplicate exact/near-identical frames.
- Use adaptive composition: 1-up (early), 2-up, then 4-up as more screens appear.

Inputs:
- `timeline/manifest.json`
- `screenshots/`

Outputs:
- `timeline/frames/quadrants/<stamp>_<sha7>_<1|2|3|4>.png`
- `timeline/frames/composite/<stamp>_<sha7>.png`
- `timeline/frame_index.json`

Arguments:
- `--manifest` (default `timeline/manifest.json`)
- `--screenshots` (default `screenshots`)
- `--frame-index` or `--out` (default `timeline/frame_index.json`)

Notes:
- Missing screens are replaced with `UNDER CONSTRUCTION` tiles when composing 4-up frames.
- Layout mode is selected by available screens per commit:
- `1` screen => full-width single frame
- `2` screens => side-by-side split
- `3+` screens => 2x2 grid (max 4 canonical screens)
- Dedup uses exact hash + perceptual hash threshold.

### 7) `render_timeline.ts`

Purpose:
- Render final mp4 from frame index with ffmpeg.

Inputs:
- `timeline/frame_index.json`

Outputs:
- `timeline/voidlock_timeline.mp4` (or custom output path)
- `timeline/frames/frames.concat.txt`

Arguments:
- `--frame-index` (default `timeline/frame_index.json`)
- `--output` (default `timeline/voidlock_timeline.mp4`)

Requirement:
- `ffmpeg` must be installed in PATH.

## `run.sh` Environment Variables

`run.sh` composes all stages and supports env overrides:

- `MANIFEST` (default `timeline/manifest.json`)
- `NAV_MAP` (default `timeline/navigation_map.json`)
- `TOPOLOGY` (default `timeline/screen_topology_changes.json`)
- `PLAYBOOKS` (default `timeline/navigation_playbooks.json`)
- `SCREENSHOTS` (default `screenshots`)
- `FRAME_INDEX` (default `timeline/frame_index.json`)
- `OUTPUT` (default `timeline/voidlock_timeline_full.mp4`)
- `PORT` (default `6080` unless positional arg is provided)
- `MAX_COUNT` (default `0`, unlimited)
- `MODE` (default `all`)
- `PLAYBOOK_PROVIDER` (default `heuristic`)
- `PLAYBOOK_EXECUTE` (default `false`)
- `PLAYBOOK_AGENT_CMD` (default empty)

## Testing Strategy

Current unit tests:
- `tests/scripts/timeline/timeline_manifest.test.ts`
- `tests/scripts/timeline/analyze_timeline_navigation.test.ts`
- `tests/scripts/timeline/analyze_screen_topology_changes.test.ts`
- `tests/scripts/timeline/plan_navigation_playbooks.test.ts`
- `tests/scripts/timeline/timeline_render.test.ts`
- `tests/scripts/timeline/analyze_timeline_frames.test.ts`
- `tests/scripts/timeline/capture_timeline.test.ts`

Run timeline tests only:

```bash
npx vitest run tests/scripts/timeline --reporter=basic
```

Run all tests:

```bash
npx vitest run --reporter=basic
```

## Golden Data Plan (Monthly, Single-Commit Reproducibility)

Goal:
- Add an integration harness so each stage can be validated against known-good commits.

Recommended approach:
1. Build a monthly commit list (one manually verified commit per month).
2. For each golden commit, run stages 2-5 in single-commit mode.
3. Assert deterministic artifacts:
- nav map contains expected target IDs.
- playbook contains expected action steps.
- capture writes at least one screenshot and no Vite error screenshot.
4. Store expected metadata in a fixture file:
- `tests/scripts/timeline/fixtures/golden_commits.json`
5. Add one integration-style test per stage that consumes the same fixture set.

Suggested fixture schema:

```json
{
  "months": [
    {
      "month": "2025-01",
      "sha": "abcdef1",
      "expect": {
        "minScreenshots": 1,
        "targetsPresentAnyOf": ["mission", "main_menu", "config", "campaign"]
      }
    }
  ]
}
```

## Troubleshooting

No screenshots captured:
- Check logs for `[candidate-fail]` and `[screen-skip]`.
- Inspect `timeline/navigation_map.json` and `timeline/navigation_playbooks.json` for that SHA.
- Verify commit builds standalone (`npm run dev -- --host 127.0.0.1 --port <port> --strictPort` inside worktree).

Frames are empty:
- Confirm `screenshots/*.png` exist and names match `<stamp>_<screen>_<sha>.png`.
- Re-run `timeline:analyze-frames`.

Render fails:
- Ensure `timeline/frame_index.json` has non-zero `keptFrames`.
- Verify `ffmpeg` installation.
