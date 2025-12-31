# src/renderer/ui

This directory contains UI components and managers for the Xenopurge renderer.

## Files

- `HUDManager.ts`: Manages the Head-Up Display, including soldier list, stats, and top bar.
- `MenuRenderer.ts`: Renders the hierarchical command menu into HTML strings.
- `HUDManager.test.ts`: Unit tests for HUD rendering and interaction, utilizing JSDOM.

## Functionality

- **HUD Updates**: Synchronizes the DOM elements with the current `GameState`. Now displays full unit stats including Accuracy, Fire Rate, and Effective Range (EffR). Includes unified objective and extraction status rendering via `renderObjectivesList`.
- **Enemy Intel**: New section in the right panel that displays stats (SPD, ACC, DMG, FR, RNG) for all currently visible enemies, grouped by type.
- **Command Menu Rendering**: Generates clickable HTML for the tactical menu.
- **Event Handling**: Manages clicks on soldier items and menu options.
