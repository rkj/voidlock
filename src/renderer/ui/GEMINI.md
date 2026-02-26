# src/renderer/ui

This directory contains UI components and managers for the Voidlock renderer.

## Files

- `HUDManager.ts`: Manages the Head-Up Display, including soldier list, stats, and top bar. Uses `UIBinder` for reactive synchronization of top bar and mobile action panel elements.
- `UIBinder.ts`: A lightweight reactive UI synchronization system that implements dirty-checking to bind `GameState` properties to DOM elements via `data-bind-*` attributes. Reduces UI "flicker" and ensures consistency across different input methods (ADR 0050).
- `KeyboardHelpOverlay.ts`: Context-aware help overlay triggered by '?' that displays active keyboard shortcuts.
- `CampaignShell.ts`: Persistent UI shell for Campaign and Custom modes, providing resource display and tab-based navigation. Features a standardized top-bar layout with navigation (Tabs) and Main Menu moved to the Top Right and uniform button heights (32px). Now supports a "custom" mode for Simulation Setup, including "Setup", "Service Record", and "Settings" tabs to allow jumping between global screens while maintaining custom mission context. Now ensures the Top Bar is rendered consistently in Statistics Mode by removing "Main Menu" from center tabs and placing it in the far-right section. Supports a `showTabs` flag to hide navigation when in transient states like Mission Setup.
- `StatDisplay.ts`: Reusable component for rendering icon-based stat blocks with tooltips.
- `SoldierWidget.ts`: Unified component for rendering soldier items across different UI contexts (Tactical, Roster, Debrief, Squad Builder).
- `MenuRenderer.ts`: Renders the hierarchical command menu into HTML strings.
- `SoldierInspector.ts`: Unified component for viewing soldier attributes and managing equipment (Paper Doll and Armory). Now excludes equipment slot 'Remove' buttons from keyboard navigation.
- `EventModal.ts`: Narrative event and outcome modals for the campaign mode.
- `ModalService.ts`: Centralized service for themed UI notifications and confirmations, replacing native dialogs.
- `AdvisorOverlay.ts`: UI component for the Advisor ("Mother"), supporting non-blocking toasts and blocking modals with character portraits and text. Features a green monochrome CRT aesthetic.
- `TooltipManager.ts`: Manages "Tap-to-Inspect" informational tooltips for mobile devices.

## Subdirectories

- `tests/`: Unit and regression tests for UI components.

## Functionality

- **Mobile Responsiveness**: Implemented a drawer-based layout for mobile devices (ADR 0038).
  - **Drawers**: The Left Panel (Squad) and Right Panel (Objectives/Intel) collapse into toggleable sliding drawers on screens < 768px.
  - **Action Panel**: Added a `mobile-action-panel` at the bottom of the screen for mission controls and the command menu, optimizing screen real estate for the game map.
  - **Touch Interactions**: All interactive elements adhere to a 44x44px minimum hit area for touch compatibility.
- **HUD Updates**: Synchronizes the DOM elements with the current `GameState`.
  - **Icon-Based Stats**: Replaced text labels (SPD, ACC, DMG, FR, RNG, VIS) with SVG icons for a cleaner tactical look. Added HTML `title` attributes for tooltips.
  - **Dual Weapon Stats**: Soldier cards now display separate stats for Left Hand (LH) and Right Hand (RH) weapons. The currently active weapon row is highlighted.
  - **Unified Objectives**: Includes unified objective and extraction status rendering via `renderObjectivesList`.
  - **Speed Slider Constraints**: Automatically adjusts the speed slider's range based on `allowTacticalPause`. If disabled, prevents speeds below 1.0x (except for absolute pause).
  - **Threat Meter Snapping**: Snaps the threat meter to its initial value at the start of a mission, disabling transitions to prevent animating down from previous mission values.
- **Debug Info**: When the debug overlay is enabled, the 'Debug Tools' section now displays Map Seed, Map Size (WxH), and Mission Type.
  - **Force Win/Lose**: Added "Force Win" and "Force Lose" buttons to the debug tools to trigger immediate mission completion or failure for testing end-of-mission flows.
- **Objective HUD Cleanup**: Objectives list now hides coordinates by default (shown only in debug mode), removes explicit status text (Pending/Completed), and adds tooltips to status icons for better clarity.
- **Enemy Intel**: New section in the right panel that displays icon-based stats for all currently visible enemies, grouped by type.
- **Command Menu Rendering**: Generates clickable HTML for the tactical menu. Now includes a **Context Header (Breadcrumbs)** to indicate the current menu hierarchy (e.g., "Orders > Move").
- **Soldier Inspector**: Shared component used in the Equipment Screen (Ready Room).
  - Displays innate soldier attributes (HP, SPD, Base ACC) and aggregate weapon stats.
  - Features a "Paper Doll" layout for equipping items to specific slots.
  - Supports full keyboard navigation and interaction for equipment management (Paper Doll and Armory).
  - Integrates with the "Pay-to-Equip" economy, handling ownership checks and Scrap deduction.
  - **Validation**: Automatically disables equipment changes and displays a warning if the selected soldier has "Dead" status.
- **Modal System**: Custom themed replacement for native `alert`, `confirm`, and `prompt` dialogs.
  - Supports queuing multiple modals.
  - Promise-based asynchronous API.
  - Fully navigable via keyboard (Enter/ESC).
  - Handles custom content and button layouts.
- **UI Casing Standardization**: All UI labels, buttons, and headers are standardized to Title Case (instead of ALL CAPS) for better readability and professional look, especially on mobile devices (Spec 11.1).
- **Tap-to-Inspect**: Implements a persistent popover system for informational tooltips on touch devices (ADR 0038). Includes a 300ms debounce to prevent immediate dismissal from rapid touch/click event sequences.
- **Component Responsiveness**: Uses CSS Container Queries to allow UI components (`SoldierWidget`, `StatDisplay`, `MenuRenderer`) to adapt their internal layout based on the width of their parent panel (ADR 0038).
- **Deployment Phase**: Implemented a dedicated deployment phase before the mission starts.
  - **Manual Deployment**: Drag and drop soldiers from the roster to highlighted spawn points on the map. Uses a custom circular drag image with tactical numbers for clear visual feedback.
  - **Auto-Fill**: Button ("Auto-Fill Spawns") to automatically assign all rostered units to available spawn points, supporting modulo-based overlapping. Utilizes `currentState` preservation in `HUDManager.ts` to ensure up-to-date state usage.
  - **Interaction**: Support for double-clicking units in the roster to deploy them to the next available spot.
  - **Validation**: "Start Mission" button is enabled only when all selected units are validly placed on unique spawn points on the map. Support is also provided for overlapping units on spawn tiles when fewer than 4 points are available.
  - **Stability Fix**: Resolved a critical `NotFoundError` in `HUDManager.ts` that occurred during deployment setup due to invalid `insertBefore` reference nodes.
- **Event Handling**: Manages clicks on soldier items and menu options.

## Related ADRs

- [ADR 0008: Renderer & UI Separation](../../../docs/adr/0008-renderer-ui-separation.md)
- [ADR 0025: ModalService Architecture](../../../docs/adr/0025-modal-service-architecture.md)
- [ADR 0028: Unified Screen Layout](../../../../docs/adr/0028-unified-screen-layout.md)
- [ADR 0048: Standardizing Pause and Speed Slider Synchronization](../../../../docs/adr/0048-pause-speed-sync.md)
- [ADR 0050: Reactive UI Binding](../../../../docs/adr/0050-reactive-ui-binding.md)
