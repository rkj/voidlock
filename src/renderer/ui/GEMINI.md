# src/renderer/ui

This directory contains UI components and managers for the Voidlock renderer.

## Files

- `HUDManager.ts`: Manages the Head-Up Display, including soldier list, stats, and top bar.
- `CampaignShell.ts`: Persistent UI shell for Campaign mode, providing resource display and tab-based navigation. Features a standardized top-bar layout with navigation (Tabs) and Main Menu moved to the Top Right and uniform button heights (32px). Supports a `showTabs` flag to hide navigation when in transient states like Mission Setup.
- `StatDisplay.ts`: Reusable component for rendering icon-based stat blocks with tooltips.
- `SoldierWidget.ts`: Unified component for rendering soldier items across different UI contexts (Tactical, Roster, Debrief, Squad Builder).
- `MenuRenderer.ts`: Renders the hierarchical command menu into HTML strings.
- `SoldierInspector.ts`: Unified component for viewing soldier attributes and managing equipment (Paper Doll and Armory).
- `EventModal.ts`: Narrative event and outcome modals for the campaign mode.
- `ModalService.ts`: Centralized service for themed UI notifications and confirmations, replacing native dialogs.

## Subdirectories

- `tests/`: Unit and regression tests for UI components.

## Functionality

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
- **Soldier Inspector**: Shared component used in Barracks and Equipment screens.
  - Displays innate soldier attributes (HP, SPD, Base ACC) and aggregate weapon stats.
  - Features a "Paper Doll" layout for equipping items to specific slots.
  - Integrates with the "Pay-to-Equip" economy, handling ownership checks and Scrap deduction.
- **Modal System**: Custom themed replacement for native `alert`, `confirm`, and `prompt` dialogs.
  - Supports queuing multiple modals.
  - Promise-based asynchronous API.
  - Fully navigable via keyboard (Enter/ESC).
  - Handles custom content and button layouts.
- Event Handling\*\*: Manages clicks on soldier items and menu options.

## Related ADRs

- [ADR 0008: Renderer & UI Separation](../../../docs/adr/0008-renderer-ui-separation.md)
- [ADR 0025: ModalService Architecture](../../../docs/adr/0025-modal-service-architecture.md)
- [ADR 0028: Unified Screen Layout](../../../../docs/adr/0028-unified-screen-layout.md)
