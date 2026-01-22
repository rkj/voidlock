# src/map-viewer

This directory contains a standalone web application dedicated to loading and displaying `MapDefinition` JSON files.

## Files

- `main.ts`: The entry point for the Map Viewer application. Handles file loading and UI interactions.
- `MapRenderer.ts`: A specialized renderer for the Map Viewer that draws cells, walls, doors, and mission entities (spawn points, etc.).

## Functionality

- **Map Visualization**: Provides a way to visually inspect generated or hardcoded map definitions without playing a full mission.
- **Debugging**: Useful for identifying map generation artifacts or verifying manual map edits.
- **Interactive Controls**: Supports click-and-drag panning and Ctrl + mouse wheel zooming.
- **Debug Overlays**: Toggleable coordinate display for floor cells.
- **Export**: Export rendered maps as high-quality PNG or SVG files.

## Connections

- Depends on `src/shared/types.ts` for map data structures.
- Uses `src/renderer/ThemeManager.ts` for consistent styling and colors.
- Shares some rendering concepts with `src/renderer/`, but is optimized for static map display.
