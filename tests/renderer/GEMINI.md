# src/renderer/tests

This directory contains the automated test suite for the Voidlock renderer, using Vitest.

## Testing Strategy

- **JSDOM Environment**: UI components (HUD, SquadBuilder) are tested using Vitest with the `jsdom` environment.
- **Manual Canvas Mocks**: The core `Renderer.ts` is tested using manual stubs for the Canvas API to avoid heavy native dependencies.

## Test Suites

- `SquadBuilder.test.ts`: Verifies squad selection logic and constraints.
- `GlobalErrorLogging.test.ts`: Verifies that global error listeners are correctly registered in main.ts.
- `screens/CampaignScreen.test.ts`: Verifies sector map rendering and node selection.
- `screens/CampaignScreen_Loot.test.ts`: Verifies bonus loot intel (star pips) display based on difficulty.
- `integration/CampaignEnd.test.ts`: Verifies that completing a Boss mission triggers the Victory state and displays the summary UI.
- `ui/tests/HUDManager.test.ts`: Verifies soldier list rendering and HUD updates.
- `InputManager.test.ts`: Verifies keyboard shortcuts and debug overlay toggles.
- `Renderer.test.ts`: Verifies map, unit, and debug/LOS overlay rendering.
- `visuals/LayerOrder.test.ts`: Verifies the rendering order of different layers (e.g., units above spawn points).
- `visuals/MapEntityLayer.test.ts`: Verifies that extraction points and other map entities respect Fog of War and discovery rules.
- `visuals/DebugLoot.test.ts`: Verifies that loot items are rendered when debug overlay is enabled, even if not visible/discovered.
- `ConfigManager.migration.test.ts`: Verifies configuration migration and defaulting from old storage formats.
- `ConfigManager.isolation.test.ts`: Verifies that Custom and Campaign configurations are stored and loaded independently.
- `MenuController.discovery.test.ts`: Verifies room discovery filtering and stable numbering in the command menu.
- `regression_09cn_room_mapping.test.ts`: Verifies room mapping logic based on discovery order and stable key assignments.
- `regression_voidlock-dp5x_quick_revive.test.ts`: Verifies Quick Revive and Quick Recruit buttons in the Mission Setup roster.
- `regression_voidlock-hs8n_vip_selection.test.ts`: Verifies VIP availability logic in Custom Missions and its exclusion from Campaign Mode.
- `regression_7twz_campaign_transition.test.ts`: Verifies that the transition from Campaign to Mission Setup is valid.
- `regression_voidlock-1i9o_map_generator_export.test.ts`: Verifies that the map generator name is correctly included in the world state export.
- `regression_rfw4_consumable_cap.test.ts`: Verifies that consumable items are limited to 2 per mission and UI feedback is provided.
- `regression_i864_redundant_prefixes.test.ts`: Verifies removal of redundant 'Unit' prefixes and distinct room labeling in the command menu.
- `integration/ScreenFlow.test.ts`: Verifies end-to-end screen transitions and game flow for both Campaign and Custom missions, including win/loss states and debriefing.
- `integration/NonCombatNodes.test.ts`: Verifies handling of Shop and Event nodes in Campaign mode.
- `integration/EquipmentPersistence.test.ts`: Verifies that equipment changes in the Ready Room are correctly persisted to the campaign roster.
- `integration/CampaignMapGenerator.test.ts`: Verifies that campaign-specific map generator settings are correctly applied when launching a mission.
- `integration/regression_voidlock_awkx_setup_shell.test.ts`: Regression test verifying CampaignShell visibility on Mission Setup.
- `integration/E2E_CampaignWin.test.ts`: E2E Campaign Happy Path test from start to victory.
- `integration/E2E_CampaignLoss.test.ts`: E2E Campaign failure mode tests (Ironman defeat, Standard casualties).
- `integration/FullCampaignFlow.test.ts`: Comprehensive E2E campaign flow test covering starting a campaign, handling casualties, boss victory, and bankruptcy/defeat.
- `integration/UserJourneys.test.ts`: Comprehensive integration test suite covering major user journeys, including New Campaign Wizard, Barracks management, Mission Abort flow, and Session Restoration.

## Related ADRs

- [ADR 0006: Autonomous Agent Architecture](../../../docs/adr/0006-autonomous-agent-architecture.md)
- [ADR 0007: Command Pattern & Queue](../../../docs/adr/0007-command-pattern-queue.md)
- [ADR 0008: Renderer & UI Separation](../../../docs/adr/0008-renderer-ui-separation.md)
