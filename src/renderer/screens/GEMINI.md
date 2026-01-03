# screens

UI screens for different game states.

## Files

- `CampaignScreen.ts`: Visualizes the Sector Map (DAG) for the campaign mode. Allows navigation between nodes and mission selection.
- `EquipmentScreen.ts`: Squad management and equipment selection UI. Features a unified `StatDisplay` system and separates Soldier Attributes (HP, Speed, Aim) from Weaponry Stats (Damage, Fire Rate, Range) for better clarity. Includes an enhanced Armory with compact item stats and detailed tooltips.

## Subdirectories

- `tests/`: Tests for individual screens.

## Related ADRs

- [ADR 0008: Renderer & UI Separation](../../../docs/adr/0008-renderer-ui-separation.md)
