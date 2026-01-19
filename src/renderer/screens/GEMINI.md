# screens

UI screens for different game states.

## Files

- `CampaignScreen.ts`: Visualizes the Sector Map (DAG) for the campaign mode, rendering within the `CampaignShell` content area. Allows navigation between nodes and mission selection. Includes a "New Campaign" wizard with card-based difficulty selection, tactical pause options, and campaign length selection (Standard vs Extended) if no active campaign exists. Uses `ModalService` for campaign reset confirmations.
- `CampaignSummaryScreen.ts`: Displays the final results of a campaign (Victory or Defeat). Shows statistics (Kills, Missions, Scrap) and the final roster status. Handles campaign termination and returns to the Main Menu.
- `DebriefScreen.ts`: Post-mission after-action report. Displays mission statistics, loot gained, and squad status (XP progress, level ups, injury reports). Features a background mission replay.
- `EquipmentScreen.ts`: Squad management and equipment selection UI. Features a unified `StatDisplay` system and separates Soldier Attributes (HP, Speed, Aim) from Weaponry Stats (Damage, Fire Rate, Range) for better clarity. Includes an enhanced Armory with compact item stats and detailed tooltips.
- `BarracksScreen.ts`: Managing the persistent roster of soldiers. Allows hiring new recruits, healing wounded soldiers, and viewing detailed stats. Uses `ModalService` for recruitment name prompts.

## Subdirectories

- `tests/`: Tests for individual screens.

## Related ADRs

- [ADR 0008: Renderer & UI Separation](../../../docs/adr/0008-renderer-ui-separation.md)
