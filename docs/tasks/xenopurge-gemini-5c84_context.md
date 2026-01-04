# Task Context: xenopurge-gemini-5c84

## Objective
Create a Node.js script (`scripts/process_assets.ts`) to automate the asset pipeline as defined in ADR 0012.

## Requirements
1.  **Source Directory**: `NanoBanana Assets/`
2.  **Output Directory**: `src/public/assets/` (Note: `index.html` is in `src/`, so standard Vite `public/` might be in `src/public/` or root `public/`. Verify `vite.config.ts`).
3.  **Operations**:
    -   Crop/Resize raw PNGs to a standardized resolution (e.g., 128x128 for tiles/units).
    -   Standardize filenames (snake_case).
    -   Generate a JSON manifest (`assets.json`) in the output directory mapping logical names to file paths.
4.  **Mappings**:
    -   `Floor Tile.png` -> `floor.png`
    -   `Wall Divider.png` -> `wall.png`
    -   `Door Closed.png` -> `door_closed.png`
    -   `Door open.png` -> `door_open.png`
    -   `Soldier Heavy.png` -> `soldier_heavy.png`
    -   ... and so on for all assets in `NanoBanana Assets/`.
5.  **Dependencies**: Use `sharp` or a similar image processing library. Add it to `package.json` if necessary.

## Verification
-   Run the script and verify that `src/public/assets/` contains the correctly formatted images and `assets.json`.
-   Ensure the script can be run via `npm run process-assets`.
