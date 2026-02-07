# Scripts

This directory contains utility scripts for development and build processes.

## Asset Processor

`scripts/process_assets.ts`

This script processes raw assets from `NanoBanana Assets/` and prepares them for the game.

### Features

- Trims transparency/crops to content.
- Resizes to standard 128x128 dimensions.
- Converts to WebP format.
- Generates `public/assets/assets.json` manifest.

### Usage

```bash
npm run process-assets
```

### Dependencies

- **Sharp**: Required for cropping, resizing, and WebP conversion. If Sharp is not installed, the script falls back to a simple file copy and maintains PNG format in the manifest.

## Timeline Video Pipeline

These scripts create a visual timeline from git history.

### `scripts/timeline_manifest.ts`

Builds `timeline/manifest.json` from commit history.

Usage:
```bash
npm run timeline:manifest
```

Arguments:
```bash
node --experimental-strip-types scripts/timeline_manifest.ts [manifest_path] [mode] [max_count] [min_hours_between]
node --experimental-strip-types scripts/timeline_manifest.ts --manifest <path> --mode <all|visual> --max-count <N> --min-hours <N>
```

- `manifest_path` (default: `timeline/manifest.json`)
- `mode`:
  - `all`: include every commit (recommended for full project history video)
  - `visual`: use visual-oriented milestone selection
- `max_count` (default: `0` = all available commits)
- `min_hours_between` (default: `8`, only used in `visual` mode)

Examples:
```bash
# Full history (all commits)
npm run timeline:manifest -- timeline/manifest.json all 5000

# Visual milestones only
npm run timeline:manifest -- timeline/manifest.json visual 200 12
```

### `scripts/capture_timeline.ts`

Captures 4 screenshots per manifest commit:
- `mission`
- `main_menu`
- `config`
- `campaign` (optional, if available)

It runs each commit in an isolated git worktree checkout and writes:
`screenshots/<datetime>_<screen_name>_<sha>.png`

Usage:
```bash
npm run timeline:capture
```

Arguments:
```bash
node --experimental-strip-types scripts/capture_timeline.ts [manifest_path] [screenshot_dir] [base_port] [max_count] [navigation_map_path]
node --experimental-strip-types scripts/capture_timeline.ts --manifest <path> --screenshots <dir> --port <N> --max-count <N> --navigation-map <path>
```

- `manifest_path` (default: `timeline/manifest.json`)
- `screenshot_dir` (default: `screenshots`)
- `base_port` (default: `6080`)
- `max_count` (default: `0` = all manifest rows) number of manifest rows to process from the start
- `navigation_map_path` (default: `timeline/navigation_map.json`) static per-commit screen/action hints

Notes:
- Safe to rerun: already-captured commits are skipped.
- Commits that fail to boot/capture are marked as `skipped` in `manifest.json`.
- Required screens are strict: `mission`, `main_menu`, and `config`.
- Required screen is strict: `mission`.
- `main_menu`, `config`, and `campaign` are optional.

### `scripts/analyze_timeline_navigation.ts`

Static analyzer for commit navigation hints (no browser render).
It checks each commit in the manifest and extracts:
- HTML ids
- screen-like container ids
- button/action ids from code
- inferred per-screen candidate targets

Usage:
```bash
npm run timeline:analyze
```

Arguments:
```bash
node --experimental-strip-types scripts/analyze_timeline_navigation.ts [manifest_path] [out_path] [max_count]
node --experimental-strip-types scripts/analyze_timeline_navigation.ts --manifest <path> --navigation-map <path> --max-count <N>
```

- `manifest_path` (default: `timeline/manifest.json`)
- `out_path` (default: `timeline/navigation_map.json`)
- `max_count` (default: `0`, meaning all manifest rows)

### `scripts/analyze_timeline_frames.ts`

Pre-render analysis step that:
- maps screenshots to canonical quadrants:
  - `1`: mission
  - `2`: main menu
  - `3`: config
  - `4`: campaign (placeholder if unavailable)
- writes normalized quadrant files:
  - `timeline/frames/quadrants/<datetime>_<sha>_<1|2|3|4>.png`
- builds composite frames:
  - `timeline/frames/composite/<datetime>_<sha>.png`
- removes exact/near-duplicate frames
- writes `timeline/frame_index.json`

Usage:
```bash
npm run timeline:analyze-frames
```

Arguments:
```bash
node --experimental-strip-types scripts/analyze_timeline_frames.ts [manifest_path] [screenshot_dir] [frame_index_path]
node --experimental-strip-types scripts/analyze_timeline_frames.ts --manifest <path> --screenshots <dir> --frame-index <path>
```

- `manifest_path` (default: `timeline/manifest.json`)
- `screenshot_dir` (default: `screenshots`)
- `frame_index_path` (default: `timeline/frame_index.json`)

### `scripts/render_timeline.ts`

Render-only step. Reads `frame_index.json` and encodes MP4 via ffmpeg.

Usage:
```bash
npm run timeline:render
```

Arguments:
```bash
node --experimental-strip-types scripts/render_timeline.ts [frame_index_path] [output_video_path]
node --experimental-strip-types scripts/render_timeline.ts --frame-index <path> --output <path>
```

- `frame_index_path` (default: `timeline/frame_index.json`)
- `output_video_path` (default: `timeline/voidlock_timeline.mp4`)

### End-to-end

```bash
npm run timeline:all
```

Manual full-history flow (named args):
```bash
npm run timeline:manifest -- timeline/manifest.json all
npm run timeline:analyze -- timeline/manifest.json timeline/navigation_map.json
npm run timeline:capture -- --manifest timeline/manifest.json --screenshots screenshots --port 6080 --max-count 0 --navigation-map timeline/navigation_map.json
npm run timeline:analyze-frames -- --manifest timeline/manifest.json --screenshots screenshots --frame-index timeline/frame_index.json
npm run timeline:render -- --frame-index timeline/frame_index.json --output timeline/voidlock_timeline_full.mp4
```

One-command runner:
```bash
npm run timeline:run
```
or:
```bash
./scripts/run_timeline_pipeline.sh 6080
```
