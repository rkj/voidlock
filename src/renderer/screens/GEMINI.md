# screens

UI screens for different game states.

## Files

All screens implement a standard interface including `show()` and `hide()` methods. The `hide()` method is critical for popping the screen's input context from the `InputDispatcher` stack to prevent input leaks.

- `CampaignScreen.ts`: Visualizes the Sector Map (DAG) for the campaign mode, rendering within the `CampaignShell` content area. Allows navigation between nodes and mission selection. Uses `NewCampaignWizard` for initial setup if no active campaign exists. Uses `ModalService` for campaign reset confirmations. Displays global meta-statistics (Total Kills, etc.) in a fixed footer. **Focus Restriction:** Keyboard navigation is restricted to only the current node and its direct accessible connections. **Visual Fidelity (voidlock-3x1vj):** Implements high-contrast white (#FFFFFF) for active paths, replaces low-fidelity emojis with crisp SVG icons for all mission nodes, and uses an atmospheric background (`bg_station` logical asset from manifest). All nodes and connections are rendered above the scanline effect (Z-Index 10 and 6 respectively) to bypass background grain and ensure maximum crispness.
- `CampaignSummaryScreen.ts`: Displays the final results of a campaign (Victory or Defeat). Shows statistics (Kills, Missions, Scrap) and the final roster status. Handles campaign termination and returns to the Main Menu.
- `DebriefScreen.ts`: Post-mission after-action report. Features a 40/60 split-pane layout displaying mission statistics and squad results in the left pane, and an integrated mission replay with playback controls (Play/Pause, Speed Selector) in the right pane. Includes a 'Replay Mission' button for Custom Mode to restart with the same seed, and an 'Export Recording' button to download the replay JSON. **Optimization:** Summary panel layout (padding, font sizes) is adjusted to ensure it remains non-scrollable at 1024x768 resolution.
- `EquipmentScreen.ts`: Squad management and equipment selection UI. Features a unified `StatDisplay` system and separates Soldier Attributes (HP, Speed, Aim) from Weaponry Stats (Damage, Fire Rate, Range) for better clarity. Includes an enhanced Armory with compact item stats and detailed tooltips. Now excludes the 'Remove' button from keyboard navigation for improved accessibility.
- `MainMenuScreen.ts`: Encapsulates the main menu logic, including keyboard navigation and focus management.
- `MissionSetupScreen.ts`: Encapsulates the mission setup/ready room logic, including map configuration, squad selection, and keyboard navigation.

## Subdirectories

- `campaign/`: Specialized campaign setup and management components.
- `tests/`: Tests for individual screens.

## Related ADRs

- [ADR 0008: Renderer & UI Separation](../../../docs/adr/0008-renderer-ui-separation.md)
