# src/renderer/ui

This directory contains UI components and managers for the Xenopurge renderer.

## Files

- `HUDManager.ts`: Manages the Head-Up Display, including soldier list, stats, and top bar.
- `MenuRenderer.ts`: Renders the hierarchical command menu into HTML strings.
- `HUDManager.test.ts`: Unit tests for HUD rendering and interaction, utilizing JSDOM.

## Functionality

- **HUD Updates**: Synchronizes the DOM elements with the current `GameState`.
- **Command Menu Rendering**: Generates clickable HTML for the tactical menu.
- **Event Handling**: Manages clicks on soldier items and menu options.