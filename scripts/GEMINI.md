# Scripts

This directory contains utility scripts for development and build processes.

## Asset Processor

`scripts/process_assets.ts`

Processes raw assets from `NanoBanana Assets/` and prepares them for the game.

Usage:
```bash
npm run process-assets
```

## Timeline Pipeline

Timeline automation now lives in `scripts/timeline/`.

### 1) Manifest

`scripts/timeline/timeline_manifest.ts`

Builds `timeline/manifest.json` from git commits.

Usage:
```bash
npm run timeline:manifest -- --manifest timeline/manifest.json --mode all --max-count 0
```

Args:
- `--manifest` output manifest path (default `timeline/manifest.json`)
- `--mode` `all|visual` (default `all`)
- `--max-count` `0` means all commits (default `0`)
- `--min-hours` spacing for `visual` mode (default `8`)

### 2) Navigation Analysis

`scripts/timeline/analyze_timeline_navigation.ts`

Static scan per commit (no browser) to extract ids/screen/action hints.

Usage:
```bash
npm run timeline:analyze -- --manifest timeline/manifest.json --navigation-map timeline/navigation_map.json --max-count 0
```

### 3) Screen Topology Changes

`scripts/timeline/analyze_screen_topology_changes.ts`

Detects where screen topology changes and outputs eras.

Usage:
```bash
npm run timeline:topology -- --manifest timeline/manifest.json --navigation-map timeline/navigation_map.json --topology timeline/screen_topology_changes.json
```

### 4) Playbook Planning

`scripts/timeline/plan_navigation_playbooks.ts`

Builds per-era navigation playbooks.

Usage (heuristic):
```bash
npm run timeline:playbooks -- --topology timeline/screen_topology_changes.json --navigation-map timeline/navigation_map.json --playbooks timeline/navigation_playbooks.json --provider heuristic
```

Usage (LLM delegation):
```bash
npm run timeline:playbooks -- --topology timeline/screen_topology_changes.json --navigation-map timeline/navigation_map.json --playbooks timeline/navigation_playbooks.json --provider gemini --execute true --agent-cmd "<cmd-with-{PROMPT_FILE}-and-{OUTPUT_FILE}>"
```

Notes:
- When external execution is enabled, prompt files are written to `timeline/playbook_prompts/`.
- If no external command is configured, prompts are generated and heuristic playbooks are used.

### 5) Capture

`scripts/timeline/capture_timeline.ts`

Captures commit screenshots with worktree + Puppeteer.

Canonical quadrants:
- `1 mission` (required)
- `2 main_menu` (optional)
- `3 config` (optional)
- `4 campaign` (optional)

Usage:
```bash
npm run timeline:capture -- --manifest timeline/manifest.json --screenshots screenshots --port 6080 --max-count 0 --navigation-map timeline/navigation_map.json --playbooks timeline/navigation_playbooks.json
```

Args:
- `--manifest`
- `--screenshots`
- `--port` default `6080` (safe for Chromium)
- `--max-count` `0` means all rows in manifest
- `--navigation-map`
- `--playbooks`

### 6) Frame Analysis (Pre-render)

`scripts/timeline/analyze_timeline_frames.ts`

Prepares normalized frame assets and dedupes before render.

Outputs:
- `timeline/frames/quadrants/<datetime>_<sha>_<1|2|3|4>.png`
- `timeline/frames/composite/<datetime>_<sha>.png`
- `timeline/frame_index.json`

Missing optional quadrants are replaced with an "UNDER CONSTRUCTION" placeholder.

Usage:
```bash
npm run timeline:analyze-frames -- --manifest timeline/manifest.json --screenshots screenshots --frame-index timeline/frame_index.json
```

### 7) Render

`scripts/timeline/render_timeline.ts`

Render-only step. Reads `frame_index.json`, outputs MP4.

Usage:
```bash
npm run timeline:render -- --frame-index timeline/frame_index.json --output timeline/voidlock_timeline_full.mp4
```

### One-command Runner

`scripts/timeline/run_timeline_pipeline.sh`

Usage:
```bash
npm run timeline:run
# or
./scripts/timeline/run_timeline_pipeline.sh 6080
```

Env overrides:
- `MANIFEST`, `NAV_MAP`, `TOPOLOGY`, `PLAYBOOKS`, `SCREENSHOTS`, `FRAME_INDEX`, `OUTPUT`
- `PORT`, `MAX_COUNT`, `MODE`
- `PLAYBOOK_PROVIDER`, `PLAYBOOK_EXECUTE`, `PLAYBOOK_AGENT_CMD`
