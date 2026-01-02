# src/renderer/ui

This directory contains UI components and managers for the Xenopurge renderer.

## Files

- `HUDManager.ts`: Manages the Head-Up Display, including soldier list, stats, and top bar.
- `StatDisplay.ts`: Reusable component for rendering icon-based stat blocks with tooltips.
- `MenuRenderer.ts`: Renders the hierarchical command menu into HTML strings.
- `HUDManager.test.ts`: Unit tests for HUD rendering and interaction, utilizing JSDOM.
- `regression_kvi1_actions_visible_on_restart.test.ts`: Regression test for the bug where actions were not visible after restarting a mission.
- `regression_pdxs_objective_hud.test.ts`: Regression test for Objective HUD cleanup (hiding coords, removing status text).

## Functionality

- **HUD Updates**: Synchronizes the DOM elements with the current `GameState`.
  - **Icon-Based Stats**: Replaced text labels (SPD, ACC, DMG, FR, RNG, VIS) with SVG icons for a cleaner tactical look. Added HTML `title` attributes for tooltips.
  - **Dual Weapon Stats**: Soldier cards now display separate stats for Left Hand (LH) and Right Hand (RH) weapons. The currently active weapon row is highlighted.
  - **Unified Objectives**: Includes unified objective and extraction status rendering via `renderObjectivesList`.
- **Objective HUD Cleanup**: Objectives list now hides coordinates by default (shown only in debug mode), removes explicit status text (Pending/Completed), and adds tooltips to status icons for better clarity.
- **Enemy Intel**: New section in the right panel that displays icon-based stats for all currently visible enemies, grouped by type.
- **Command Menu Rendering**: Generates clickable HTML for the tactical menu.
- Event Handling**: Manages clicks on soldier items and menu options.

## Related ADRs

- [ADR 0008: Renderer & UI Separation](../../../docs/adr/0008-renderer-ui-separation.md)
