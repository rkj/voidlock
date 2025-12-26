# src/renderer/ui

This directory contains specific UI management and rendering components for the Xenopurge interface.

## Files

- `HUDManager.ts`: Manages the Heads-Up Display, including the soldier status bar, threat meter, and objective list.
- `MenuRenderer.ts`: Handles the visual presentation of the hierarchical command menu.
- `placeholder.ts`: A placeholder file for future UI components.

## Functionality

- **UI Layout**: Organizes and updates the various overlays that sit on top of the game canvas.
- **State Synchronization**: Ensures the UI reflects the current game state received from the engine.

## Connections

- Used by `src/renderer/Renderer.ts` and `src/renderer/main.ts` to build the full game interface.
