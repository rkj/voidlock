# src/renderer

This directory contains the main thread rendering logic and user interface for Xenopurge.

## Files

- `main.ts`: The entry point for the main game application. Initializes the `GameClient`, `Renderer`, and UI components.
- `Renderer.ts`: The core rendering engine using HTML5 Canvas. Handles drawing the map, units, combat effects, and fog of war.
- `InputManager.ts`: Manages mouse and keyboard input, translating them into game actions.
- `ScreenManager.ts`: Manages transitions between different screens (Main Menu, Setup, Mission).
- `MenuController.ts`: Implements the hierarchical keyboard-driven command menu. Includes context-aware logic to hide or disable options based on game state (e.g., hiding undiscovered extraction points).
- `ConfigManager.ts`: Handles loading and saving game configuration and mission parameters.
- `VisibilityPolygon.ts`: Implements visibility calculations for rendering accurate LOS cones.
- `Icons.ts`: Contains SVG or canvas-based icon definitions for units, UI elements, and core unit statistics (Speed, Accuracy, Damage, Rate, Range).
- `MapUtility.ts`: Utility functions for map coordinate transformations and rendering helpers.
- `MenuConfig.ts`: Configuration for the hierarchical menu structure.

## Subdirectories

- `campaign/`: Campaign management logic and state persistence.
- `ui/`: Specific UI components like the HUD and menu renderers.
- `screens/`: Individual screen components for the Strategic and Tactical layers.

## Functionality

- **Real-time Rendering**: Efficiently draws the game state at 60 FPS.
- **Hierarchical Command Menu**: A keyboard-first interface for controlling squad members.
- **Fog of War**: Implements visual shroud and discovery states based on the simulation data.
- **Visual Feedback**: Provides tactical information through tracers, health bars, and status overlays. Includes a high-precision threat bar in `index.html` with pixel-perfect divider alignment.

## Testing

- **JSDOM Environment**: UI components (HUD, SquadBuilder) are tested using Vitest with the `jsdom` environment.
- **Manual Canvas Mocks**: The core `Renderer.ts` is tested using manual stubs for the Canvas API to avoid heavy native dependencies.
- **Test Suites**:
  - `SquadBuilder.test.ts`: Verifies squad selection logic and constraints.
  - `ui/HUDManager.test.ts`: Verifies soldier list rendering and HUD updates.
  - `ConfigManager.migration.test.ts`: Verifies configuration migration and defaulting from old storage formats.
  - `MenuController.discovery.test.ts`: Verifies room discovery filtering and stable numbering in the command menu.

## Connections

- Communicates with the engine via `src/engine/GameClient.ts`.
- Uses types from `src/shared/types.ts`.
- Rendered in `index.html`.
