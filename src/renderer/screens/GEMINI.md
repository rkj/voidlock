# screens

UI screens for different game states.

## Files

All screens implement a standard interface including `show()` and `hide()` methods. The `hide()` method is critical for popping the screen's input context from the `InputDispatcher` stack to prevent input leaks.

- `CampaignScreen.ts`: Visualizes the Sector Map (DAG) for the campaign mode, rendering within the `CampaignShell` content area. Allows navigation between nodes and mission selection. Uses `NewCampaignWizard` for initial setup if no active campaign exists. Uses `ModalService` for campaign reset confirmations. Displays global meta-statistics (Total Kills, etc.) in a fixed footer. **Focus Restriction:** Keyboard navigation is restricted to only the current node and its direct accessible connections. **Visual Fidelity (voidlock-3x1vj):** Implements high-contrast white (#FFFFFF) for active paths, replaces low-fidelity emojis with crisp SVG icons for all mission nodes, and uses an atmospheric background (`bg_station` logical asset from manifest). All nodes and connections are rendered above the scanline effect (Z-Index 10 and 6 respectively) to bypass background grain and ensure maximum crispness. **Regression Guard (voidlock-1gvpw):** Verified via E2E test that icons are rendered with non-zero dimensions and remain visible.
- `CampaignSummaryScreen.ts`: Displays the final results of a campaign (Victory or Defeat). Shows statistics (Kills, Missions, Scrap) and the final roster status. Handles campaign termination and returns to the Main Menu.
- `DebriefScreen.ts`: Post-mission after-action report. Features a 40/60 split-pane layout displaying mission statistics and squad results in the left pane, and an integrated mission replay with playback controls (Play/Pause, Speed Selector) in the right pane. Includes a 'Replay Mission' button for Custom Mode to restart with the same seed, and an 'Export Recording' button to download the replay JSON. **Optimization:** Summary panel layout (padding, font sizes) is adjusted to ensure it remains non-scrollable at 1024x768 resolution.
- `EngineeringScreen.ts`: Strategic screen for unlocking new unit archetypes and advanced equipment using persistent Intel. Implements Spec 8.1 with atmospheric background (`bg_station`), grain, and scanline effects.
- `EquipmentScreen.tsx`: Squad management and equipment selection UI. Features a unified `StatDisplay` system and separates Soldier Attributes (HP, Speed, Aim) from Weaponry Stats (Damage, Fire Rate, Range) for better clarity. Includes an enhanced Armory with compact item stats and detailed tooltips. Now excludes the 'Remove' button from keyboard navigation for improved accessibility. The legacy 'Confirm Squad' button has been replaced by auto-persistence and context-aware 'Back' or 'Launch Mission' footer buttons. Features a persistent **Recruit** button in the roster panel to allow reinforcements even when the squad is full (regression_tkzi). Now implements **Guided Prologue Flow** (ADR 0049), **Mission 2 Ready Room** flow, and **Mission 3 Squad Selection** flow by dynamically locking/unlocking the Armory and Squad Selection based on campaign progress. **Fix (voidlock-i374n):** Increased left panel width to 260px to ensure soldier cards are at least 200px wide. **Validation (voidlock-n4sd6):** Prevents launching a mission with an empty squad by disabling the "Launch Mission" button and providing visual feedback.
- `MainMenuScreen.ts`: Encapsulates the main menu logic, including keyboard navigation and focus management.
- `MissionSetupScreen.ts`: Encapsulates the mission setup/ready room logic, including map configuration, squad selection, and keyboard navigation.
- `SettingsScreen.ts`: Strategic screen for managing global game settings and resetting progress. Implements Spec 8.1 with atmospheric background (`bg_station`), grain, and scanline effects.
- `StatisticsScreen.ts`: Strategic screen for viewing global meta-statistics and service record. Implements Spec 8.1 with atmospheric background (`bg_station`), grain, and scanline effects.

## Subdirectories

- `campaign/`: Specialized campaign setup and management components.
- `tests/`: Tests for individual screens.

## Related ADRs

- [ADR 0008: Renderer & UI Separation](../../../docs/adr/0008-renderer-ui-separation.md)
