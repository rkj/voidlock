# src/renderer

This directory contains the main thread rendering logic and user interface for Voidlock.

## Files

- `main.ts`: The minimal entry point for the main game application. It instantiates and starts the `GameApp`.
- `Renderer.ts`: The main entry point for the rendering system. Now refactored into a layered architecture (ADR 0018). It acts as a compositor for specialized layers.

## Subdirectories

- `app/`: Application lifecycle and bootstrapping logic (ADR 0019).
- `visuals/`: Layered rendering system (MapLayer, UnitLayer, EffectLayer, OverlayLayer).
- `controllers/`: Decoupled logic managers for the tactical UI (StateMachine, Selection, CommandBuilder, RoomDiscovery).
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
