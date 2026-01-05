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
