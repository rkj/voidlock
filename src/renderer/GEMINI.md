# src/renderer

This directory contains the main thread rendering logic and user interface for Voidlock.

## Files

- `main.ts`: The minimal entry point for the main game application. It instantiates and starts the `GameApp`. Now includes global error logging and unhandled rejection tracking (Spec 8.12).
- `GameShell.ts`: Manages the main application layout and top-level DOM elements. Now includes standardized runtime checks for required elements.
- `ConfigManager.ts`: Manages persistent game configuration and defaults (Map size, Unit Style, Mission types) in LocalStorage. Now includes strict validation and default fallback logic (Spec 8.12). Default mission generator is now set to `DenseShip`.
- `InputDispatcher.ts`: Centralized keyboard, mouse, and touch event dispatcher and focus manager. Supports priority-based event handling, focus trapping for modals/screens, and automatic focus restoration (ADR 0037). Now handles 1-finger panning and 2-finger pinch zooming for mobile devices (ADR 0038).
- `GlobalShortcuts.ts`: Registry for global shortcuts (Space=Pause, ESC/Q=Back) that applies across all screens.
- `InputManager.ts`: Manages tactical input context, including keyboard shortcuts and mouse/touch interactions. Implements 1-finger panning, 2-finger pinch zooming, and Tap-to-Move/Select (ADR 0038). Now correctly initialized in `GameApp.initialize()` to ensure event listeners and shortcuts are active. Supports native HTML5 drag and drop for unit deployment with custom circular drag images, and manual canvas-based dragging during deployment with closest-unit selection and visual ghost feedback.
- `MenuController.ts`: Orchestrates the tactical command menu, handling state transitions, selection, and command construction. Now includes validation logic to disable the Escort command when fewer than 2 active units are present and filters out targets from the escorting unit selection.
- `Renderer.ts`: The main entry point for the rendering system. Now refactored into a layered architecture (ADR 0018). It acts as a compositor for specialized layers.
- `ScreenManager.ts`: Manages screen transitions, history, and URL hash synchronization. Currently handles transitions instantaneously via `display: none/flex` (static feel). Now includes a `destroy()` method for clean shutdown and uses an `isInternalTransition` flag to prevent redundant external change callbacks during programmatic transitions.

## Subdirectories

- `app/`: Application lifecycle and bootstrapping logic (ADR 0019).
  - `GameApp.ts`: Central orchestrator that manages screen lifecycle via a centralized `switchScreen` method, ensuring proper hiding/showing and input context cleanup across all screens. Handles node selection in Campaign Mode, including non-combat dispatch for Shop and Event nodes.
- `components/`: Reusable UI components (e.g., SquadBuilder).
- `visuals/`: Layered rendering system (MapLayer, UnitLayer, EffectLayer, OverlayLayer).
- `controllers/`: Decoupled logic managers for the tactical UI (StateMachine, Selection, CommandBuilder, RoomDiscovery, TargetOverlay).
- `campaign/`: Campaign management logic and state persistence.
- `ui/`: Specific UI components like the HUD and menu renderers.
- `screens/`: Individual screen components for the Strategic and Tactical layers.
  - `CampaignScreen.ts`: Displays the Sector Map DAG.
  - `EquipmentScreen.ts`: Handles soldier loadouts and armory. Implements pay-to-equip economic logic where new equipment purchases deduct Scrap from the campaign balance while re-equipping owned items is free.
  - `DebriefScreen.ts`: Displays mission results and plays accelerated replay in background. **Optimization:** Summary panel layout (padding, font sizes) is adjusted to ensure it remains non-scrollable at 1024x768 resolution.
  - `CampaignSummaryScreen.ts`: Displays final victory or defeat reports for the campaign.
  - `StatisticsScreen.ts`: Displays cumulative global statistics (Service Record).
- `tests/`: Automated test suite for the renderer.

## Functionality

- **Real-time Rendering**: Efficiently draws the game state at 60 FPS.
- **Centralized Input & Focus**: Implements a robust system for global keyboard shortcuts and UI focus management. Tracks active input contexts (Tactical, UI, Modal) and handles Tab cycling to keep focus within active overlays. (ADR 0037)
- **Hierarchical Command Menu**: A keyboard-first interface for controlling squad members. Includes unit-targeted self-heal for Medkits/Stimpacks, and global/cell targeting for Grenades and Scanners. Features contextual validation for commands (e.g., disabling Escort for single units).
- **Drag & Drop Squad Builder**: A modern interface for selecting and assigning units to the squad, featuring a draggable roster and deployment slots with mission-specific locking (e.g., VIPs). Supports up to 4 soldiers plus a separate VIP slot. Includes **Quick Actions** (Revive for Clone mode, Recruit for generic reinforcements).
- **Mission Setup**: Allows configuring map parameters for custom missions. Automatically calculates the recommended number of enemy spawn points based on map size (`1 + floor((size - 6) / 2)`), while allowing manual overrides. Features a Campaign Context Header displaying difficulty, mission number, and sector when in campaign mode. Now supports **Environment Theme selection** (Default, Industrial, Hive) for custom missions, which persists in local configuration. Includes a **Visual Style Preview** that demonstrates the difference between "Tactical Icons" and "Sprites" rendering modes. Now integrated into `CampaignShell` for both Campaign and Custom modes to ensure consistent navigation.
- **Fog of War**: Implements visual shroud and discovery states based on the simulation data.
- **Reset Data**: Provides a way to wipe all campaign progress and settings via the Global Settings Screen (moved from Main Menu for safety).
- **URL Synchronization**: The current screen (Main Menu, Campaign, Mission Setup, etc.) is synchronized with the URL hash, allowing for deep linking and browser back/forward navigation.
- **Advisor Intro Modal**: Implemented a blocking narrative modal for the Advisor (\"Mother\") that triggers before the Prologue mission launches. Displays mission objectives and backstory with thematic illustrations and a CRT green monochrome aesthetic.
- **Global Stats**: Displays cumulative statistics (Service Record) via a dedicated Statistics Screen, now a top-level global component (ADR 0032).
- **UI Casing Standardization**: All UI labels, buttons, and headers are standardized to Title Case (instead of ALL CAPS) for better readability and professional look, especially on mobile devices (Spec 11.1).
- **Visual Feedback**: Provides tactical information through tracers, health bars, and status overlays. Includes a high-precision threat bar in `index.html` with pixel-perfect divider alignment.
- **Component Responsiveness**: Uses CSS Container Queries (`@container`) to allow reusable UI components like `SoldierCard`, `StatDisplay`, and `Menu` to adapt their internal layout based on the width of their parent container, ensuring a consistent experience across different device sizes and layout panels (ADR 0038).

## Connections

- Communicates with the engine via `src/engine/GameClient.ts`.
- Uses types from `src/shared/types.ts`.
- Rendered in `index.html`.

## References

- **ADR 0006**: Autonomous Agent Architecture (AI & Tick Sync)
- **ADR 0007**: Command Pattern & Queue (Shared Protocol)
- **ADR 0008**: Renderer & UI Separation (Hybrid Rendering)
- **ADR 0012**: Theming System & Asset Pipeline
- **ADR 0028**: Unified Screen Layout & Global Shell
- **ADR 0032**: Global UI Persistence and Entity Visibility
- **ADR 0037**: Centralized Input & Focus Management System
- **ADR 0038**: Mobile Interaction Strategy (Touch & Responsiveness)
- **ADR 0039**: State Separation and Versioning (Custom vs. Campaign)
- **ADR 0048**: Standardizing Pause and Speed Slider Synchronization
