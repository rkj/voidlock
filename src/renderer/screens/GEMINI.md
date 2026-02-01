# screens

UI screens for different game states.

## Files

- `CampaignScreen.ts`: Visualizes the Sector Map (DAG) for the campaign mode, rendering within the `CampaignShell` content area. Allows navigation between nodes and mission selection. Uses `NewCampaignWizard` for initial setup if no active campaign exists. Uses `ModalService` for campaign reset confirmations. Displays global meta-statistics (Total Kills, etc.) in a fixed footer.
- `CampaignSummaryScreen.ts`: Displays the final results of a campaign (Victory or Defeat). Shows statistics (Kills, Missions, Scrap) and the final roster status. Handles campaign termination and returns to the Main Menu.
- `DebriefScreen.ts`: Post-mission after-action report. Features a 40/60 split-pane layout displaying mission statistics and squad results in the left pane, and an integrated mission replay with playback controls (Play/Pause, Speed Selector) in the right pane.
- `EquipmentScreen.ts`: Squad management and equipment selection UI. Features a unified `StatDisplay` system and separates Soldier Attributes (HP, Speed, Aim) from Weaponry Stats (Damage, Fire Rate, Range) for better clarity. Includes an enhanced Armory with compact item stats and detailed tooltips.
- `BarracksScreen.ts`: Managing the persistent roster of soldiers. Allows hiring new recruits, healing wounded soldiers, and viewing detailed stats. Uses `ModalService` for recruitment name prompts.

## Subdirectories

- `campaign/`: Specialized campaign setup and management components.
- `tests/`: Tests for individual screens.

## Related ADRs

- [ADR 0008: Renderer & UI Separation](../../../docs/adr/0008-renderer-ui-separation.md)
