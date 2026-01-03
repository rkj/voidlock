# src/renderer/ui/tests

Tests for UI components and managers in the Voidlock renderer.

## Files

- `HUDManager.test.ts`: Unit tests for HUD rendering and interaction, utilizing JSDOM.
- `HUDManager_Stats.test.ts`: Tests for soldier stat rendering within the HUD.
- `StatDisplay.test.ts`: Tests for the reusable icon-based stat display component.
- `regression_kvi1_actions_visible_on_restart.test.ts`: Regression test for the bug where actions were not visible after restarting a mission.
- `regression_pdxs_objective_hud.test.ts`: Regression test for Objective HUD cleanup (hiding coords, removing status text).

## Related ADRs

- [ADR 0008: Renderer & UI Separation](../../../../docs/adr/0008-renderer-ui-separation.md)
