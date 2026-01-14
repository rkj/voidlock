# src/engine/managers

This directory contains specialized managers that handle specific domains of the game state and logic within the `CoreEngine`.

## Files

- `CampaignManager.ts`: Orchestrates the strategic layer, managing persistent state, squad roster, and sector map progression. Implemented as a singleton that uses a `StorageProvider` for persistence. Handles mission reconciliation, including XP calculation, soldier leveling, and stat boosts (+20 Max HP, +5 Aim per level). Enforces the rule that dead soldiers receive 0 XP and cannot level up. Enforces forward progression on the sector map by marking sibling nodes as `Skipped` and incrementing `currentSector` (Rank + 2) after a mission. Provides `advanceCampaignWithoutMission` for non-combat nodes (Shop/Event). Provides methods for roster management: recruitment (100 Scrap), healing (50 Scrap), revival (250 Scrap, Clone mode only), `spendScrap(amount)` for economic transactions, equipment assignment, `reset()` to clear the campaign state, and `deleteSave()` to remove it from storage. `startNewCampaign` accepts a seed, difficulty level, and an optional `overrides` object (supporting `customSeed`, `mapGeneratorType`, `scaling`, `scarcity`, `deathRule`, etc.) or legacy optional arguments, and scales starting scrap based on difficulty (1000, 500, 300, or 150). Tracks campaign outcome via a `status` field ("Active", "Victory", "Defeat"), enforcing "Defeat" on mission failure in Ironman mode, on bankruptcy in other modes (0 alive soldiers and < 100 Scrap), and "Victory" upon successfully completing a mission at a "Boss" node.
- `CombatManager.ts`: Manages target selection, Line of Fire (LOF) checks, weapon selection, and cooldowns. Applies damage to enemies and updates unit kill counts.
- `CommandExecutor.ts`: Translates `Command` objects (MOVE, STOP, etc.) into actionable unit states (pathfinding, state resets). Supports `targetUnitId` for `USE_ITEM` commands, handling movement towards targets before item activation. Now automatically appends a `RESUME_AI` command to the unit's queue for manual `PICKUP` and `USE_ITEM` orders if `aiEnabled` was true.
- `CommandHandler.ts`: Processes and validates incoming commands from the player or bots. Handles debug commands like `DEBUG_FORCE_WIN` (which also marks objectives as completed) and `DEBUG_FORCE_LOSE` for testing purposes.
- `DoorManager.ts`: Manages the state (Open, Closed, Locked, Destroyed) and logic of doors.
- `EnemyManager.ts`: Manages the lifecycle and state updates for all enemy units. Handles scrap rewards for elite kills.
- `LootManager.ts`: Manages spawning and despawning of dropped items (loot) on the map.
- `MissionManager.ts`: Handles mission-specific setup, objective tracking, scrap reward calculation, and win/loss conditions. Supports special logic for `Boss` nodes (3 objectives, 3x scrap) and `Elite` nodes (2 objectives, 2x scrap), including specialized Hive/Recover mix. Boss/Elite missions trigger instant win upon all objectives being completed.
- `MovementManager.ts`: Translates path data into unit position updates. Handles door interactions and formation offsets.
- `StatsManager.ts`: Calculates derived stats (Speed, HP, Accuracy) from base archetypes, equipment, and status effects.
- `UnitAI.ts`: Implements autonomous decision-making for units, including VIP behaviors, retreat logic, opportunistic loot/objective pickup (respecting distance-based assignments), and map exploration. Coordinates with `VipAI` for specialized unit behaviors.
- `UnitManager.ts`: Orchestrates the lifecycle, movement, combat, and AI updates for soldier units. Delegates combat to `CombatManager`, stats calculation to `StatsManager`, movement updates to `MovementManager`, command execution to `CommandExecutor`, and autonomous decision-making to `UnitAI`. Handles loot interaction, `PICKUP` and `USE_ITEM` commands, and attributes kills to individual units for XP calculation. Supports autonomous "Sticky Target" logic where soldiers prioritize threats using a heuristic (`Score = (MaxHP - CurrentHP) + (100 / Distance)`) and maintain focus on a target until it dies or leaves range/LOF. Supports autonomous "Opportunistic Pickup" of visible loot and objectives, resolving competition between units by assigning items to the closest capable unit. Supports the `ESCORT_UNIT` command with dynamic formation logic (Vanguard, Rearguard, Bodyguard roles) and speed synchronization to ensure escorts keep pace with their target. `USE_ITEM` commands can be channeled (e.g., Medkits, Mines), during which the unit is stationary until the action completes. Manual commands issued to units (except `EXPLORE` or `RESUME_AI`) automatically disable autonomous behavior (`aiEnabled = false`) to ensure user orders take priority over autonomous exploration. However, simple task-based manual commands like `PICKUP` and `USE_ITEM` will automatically queue a `RESUME_AI` command if AI was enabled when the command was issued, ensuring the unit returns to its autonomous behavior after completion. Persistent commands like `ESCORT_UNIT`, `EXPLORE`, and `OVERWATCH_POINT` are not cleared when the unit is idle.
- `VisibilityManager.ts`: Manages fog-of-war and unit line-of-sight updates.
- `placeholder.ts`: A placeholder file, possibly for future managers or as a template.

## Functionality

- **Unit & Enemy Management**: `UnitManager` and `EnemyManager` handle movement and combat logic, including hit chance calculations based on the new Weapon/Aim model (`HitChance = ((SoldierAim + WeaponMod + EquipmentBonus) / 100) * (WeaponEffectiveRange / Distance)`). `UnitManager` delegates to `CombatManager` for target acquisition, autonomous weapon switching between melee and ranged weapons based on target distance, and attack execution. It delegates to `StatsManager` for dynamic stat recalculation (applying bonuses from equipment and burdens from carried objectives). Movement updates are delegated to `MovementManager`. Autonomous behaviors and exploration logic are delegated to `UnitAI`.
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
- [ADR 0010: Unit System Architecture](../../../docs/adr/0010-unit-system-architecture.md)
