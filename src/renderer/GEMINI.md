# src/renderer

This directory contains the main thread rendering logic and user interface for Voidlock.

## Files

- `main.ts`: The entry point for the main game application. Initializes the `GameClient`, `Renderer`, and UI components.
- `Renderer.ts`: The core rendering engine using HTML5 Canvas. Handles drawing the map, units (using sprites or geometric fallbacks), enemies, combat effects, and fog of war.
- `DebugUtility.ts`: Utility for debug-related actions, such as capturing and copying world state to the clipboard with robust fallbacks.
- `TimeUtility.ts`: Utility for logarithmic time scale conversions (slider to scale and vice versa) and speed formatting for UI (including Active Pause at 0.05x).
- `InputManager.ts`: Manages mouse and keyboard input. It is decoupled from the specific command protocol by using callbacks for actions like pausing and toggling overlays.
- `ScreenManager.ts`: Manages transitions between different screens (Main Menu, Setup, Mission).
- `SessionManager.ts`: Manages persistent session state for crash recovery and navigation restoration.
- `ScreenTransitions.ts`: Defines the valid state machine transitions for the ScreenManager.
- `MenuController.ts`: Implements the hierarchical keyboard-driven command menu using a formal state machine and state stack for robust back-navigation.
  Includes context-aware logic to hide or disable options based on game state (e.g. Grenades are disabled if no enemies are visible), handles specific item targeting modes (Friendly vs Hostile units), and handles Shift-key modifiers for command queueing.
- `ConfigManager.ts`: Handles loading and saving game configuration and mission parameters. Supports isolated storage for Custom Missions and Campaign mode to prevent state pollution.
- `VisibilityPolygon.ts`: Implements visibility calculations for rendering accurate LOS cones.
- `Icons.ts`: Contains URL definitions for tactical icons pointing to external SVG files.
- `MapUtility.ts`: Utility functions for map coordinate transformations and rendering helpers.
- `MenuConfig.ts`: Configuration for the hierarchical menu structure.
- `ThemeManager.ts`: Centralized management of visual themes, CSS variables, and asset mapping. Loads the `assets.json` manifest and provides URL lookups for sprites and icons. Supports `ThemeConfig` for programmatic overrides.

## Subdirectories

- `campaign/`: Campaign management logic and state persistence.
- `ui/`: Specific UI components like the HUD and menu renderers.
- `screens/`: Individual screen components for the Strategic and Tactical layers.
  - `CampaignScreen.ts`: Displays the Sector Map DAG.
  - `BarracksScreen.ts`: Interface for roster management, recruitment, and soldier healing/equipment.
  - `EquipmentScreen.ts`: Handles soldier loadouts and armory. Implements pay-to-equip economic logic where new equipment purchases deduct Scrap from the campaign balance while re-equipping owned items is free.
  - `DebriefScreen.ts`: Displays mission results and plays accelerated replay in background.
- `tests/`: Automated test suite for the renderer.

## Functionality

- **Real-time Rendering**: Efficiently draws the game state at 60 FPS.
- **Hierarchical Command Menu**: A keyboard-first interface for controlling squad members.
- **Drag & Drop Squad Builder**: A modern interface for selecting and assigning units to the squad, featuring a draggable roster and deployment slots with mission-specific locking (e.g., VIPs).
- **Mission Setup**: Allows configuring map parameters for custom missions. Automatically calculates the recommended number of enemy spawn points based on map size (`1 + floor((size - 6) / 2)`), while allowing manual overrides.
- **Fog of War**: Implements visual shroud and discovery states based on the simulation data.
- **Reset Data**: Provides a way to wipe all campaign progress and settings via the Main Menu.
- **Visual Feedback**: Provides tactical information through tracers, health bars, and status overlays. Includes a high-precision threat bar in `index.html` with pixel-perfect divider alignment.

## Connections

- Communicates with the engine via `src/engine/GameClient.ts`.
- Uses types from `src/shared/types.ts`.
- Rendered in `index.html`.

## References

- **ADR 0006**: Autonomous Agent Architecture (AI & Tick Sync)
- **ADR 0007**: Command Pattern & Queue (Shared Protocol)
- **ADR 0008**: Renderer & UI Separation (Hybrid Rendering)
- **ADR 0012**: Theming System & Asset Pipeline
