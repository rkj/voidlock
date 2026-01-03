# src/engine/managers

This directory contains specialized managers that handle specific domains of the game state and logic within the `CoreEngine`.

## Files

- `CampaignManager.ts`: Orchestrates the strategic layer, managing persistent state, squad roster, and sector map progression. Implemented as a singleton that uses a `StorageProvider` for persistence. Handles mission reconciliation, including XP calculation, soldier leveling, and stat boosts (+20 Max HP, +5 Aim per level).
- `CommandHandler.ts`: Processes and validates incoming commands from the player or bots.
- `DoorManager.ts`: Manages the state (Open, Closed, Locked, Destroyed) and logic of doors.
- `EnemyManager.ts`: Manages the lifecycle and state updates for all enemy units. Handles scrap rewards for elite kills.
- `LootManager.ts`: Manages spawning and despawning of dropped items (loot) on the map.
- `MissionManager.ts`: Handles mission-specific setup, objective tracking, scrap reward calculation, and win/loss conditions.
- `UnitManager.ts`: Manages the lifecycle, movement, combat, and AI updates for soldier units. Handles loot interaction, `PICKUP` and `USE_ITEM` commands, and attributes kills to individual units for XP calculation. Supports the `ESCORT_UNIT` command with dynamic formation logic (Vanguard, Rearguard, Bodyguard roles) and speed synchronization to ensure escorts keep pace with their target. `USE_ITEM` commands can be channeled (e.g., Medkits, Mines), during which the unit is stationary until the action completes. Manual commands issued to units (except `EXPLORE` or `RESUME_AI`) automatically disable autonomous behavior (`aiEnabled = false`) to ensure user orders take priority over autonomous exploration. Persistent commands like `ESCORT_UNIT`, `EXPLORE`, and `OVERWATCH_POINT` are not cleared when the unit is idle.
- `VisibilityManager.ts`: Manages fog-of-war and unit line-of-sight updates.
- `placeholder.ts`: A placeholder file, possibly for future managers or as a template.

## Functionality

- **Unit & Enemy Management**: `UnitManager` and `EnemyManager` handle movement and combat logic, including hit chance calculations based on the new Weapon/Aim model (`HitChance = ((SoldierAim + WeaponMod + EquipmentBonus) / 100) * (WeaponEffectiveRange / Distance)`). `UnitManager` also handles autonomous weapon switching between melee and ranged weapons based on target distance, ensuring accuracy stats (`soldierAim`, `equipmentAccuracyBonus`) are preserved during swaps. `UnitManager` includes `recalculateStats` to dynamically apply bonuses from equipment and burdens from carried objectives (like the "Artifact Burden" which reduces speed and accuracy).
- **Infinite Sight**: Soldiers have infinite sight range by default, managed via `VisibilityManager`.
- **Unified Pacing**: Managers follow the global `scaledDt` to ensure that movement, threat growth, and timed actions (like extraction) scale consistently with the game speed setting. This ensures that pausing the game freezes all simulation logic.

## Subdirectories

- `tests/`: Tests for various engine managers.

## Connections

- All managers are instantiated and orchestrated by `src/engine/CoreEngine.ts`.
- They frequently interact with each other (e.g., `UnitManager` uses `VisibilityManager` and `DoorManager`).

## Related ADRs

- [ADR 0006: Autonomous Agent Architecture](../../../docs/adr/0006-autonomous-agent-architecture.md)
- [ADR 0007: Command Pattern & Queue](../../../docs/adr/0007-command-pattern-queue.md)
