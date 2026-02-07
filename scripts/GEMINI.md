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
```

- `manifest_path` (default: `timeline/manifest.json`)
- `mode`:
  - `all`: include every commit (recommended for full project history video)
  - `visual`: use visual-oriented milestone selection
- `max_count` (default: `5000`)
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
- `main_menu`
- `mission_setup`
- `equipment`
- `mission`

It runs each commit in an isolated git worktree checkout and writes:
`screenshots/<datetime>_<screen_name>_<sha>.png`

Usage:
```bash
npm run timeline:capture
```

Arguments:
```bash
node --experimental-strip-types scripts/capture_timeline.ts [manifest_path] [screenshot_dir] [base_port] [max_count]
```

- `manifest_path` (default: `timeline/manifest.json`)
- `screenshot_dir` (default: `screenshots`)
- `base_port` (default: `5178`)
- `max_count` (default: `24`) number of manifest rows to process from the start

Notes:
- Safe to rerun: already-captured commits are skipped.
- Commits that fail to boot/capture are marked as `skipped` in `manifest.json`.

### `scripts/render_timeline.ts`

Builds a 2x2 composite frame per commit and renders MP4 via ffmpeg.
It deduplicates visually identical or near-identical frames before encoding.

Usage:
```bash
npm run timeline:render
```

Arguments:
```bash
node --experimental-strip-types scripts/render_timeline.ts [manifest_path] [screenshot_dir] [output_video_path]
```

- `manifest_path` (default: `timeline/manifest.json`)
- `screenshot_dir` (default: `screenshots`)
- `output_video_path` (default: `timeline/voidlock_timeline.mp4`)

### End-to-end

```bash
npm run timeline:all
```

Manual full-history flow:
```bash
npm run timeline:manifest -- timeline/manifest.json all 5000
npm run timeline:capture -- timeline/manifest.json screenshots 5178 900
npm run timeline:render -- timeline/manifest.json screenshots timeline/voidlock_timeline_full.mp4
```
