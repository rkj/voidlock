# src/engine/managers

This directory contains specialized managers that handle specific domains of the game state and logic within the `CoreEngine`.

## Files

- `CampaignManager.ts`: Deprecated. Re-exports `CampaignManager` from `src/engine/campaign/` for backward compatibility.
- `CombatManager.ts`: Manages target selection, Line of Fire (LOF) checks, weapon selection, and cooldowns. Unifies attack logic for both units and enemies, emitting `AttackEvent`s for visual feedback. Applies damage to targets and updates unit kill counts.
- `CommandExecutor.ts`: Translates `Command` objects (MOVE, STOP, etc.) into actionable unit states (pathfinding, state resets). Uses a `UnitCommandRegistry` with specialized handlers for each command type to ensure extensibility and SRP. Supports `targetUnitId` for `USE_ITEM` commands, handling movement towards targets before item activation. Now automatically appends a `RESUME_AI` command to the unit's queue for manual `PICKUP` and `USE_ITEM` orders if `aiEnabled` was true. **ADR 0056:** Manual commands now immediately invalidate and clear the unit's `activePlan`.
- `CommandHandler.ts`: Processes and validates incoming commands from the player or bots. Uses a `GlobalCommandRegistry` with specialized handlers to route commands based on `CommandType`. Handles global commander abilities (Heal, Grenade, Scanner) when `unitIds` is empty, ensuring single-decrement squad inventory logic. Also handles debug commands like `DEBUG_FORCE_WIN` (which also marks objectives as completed) and `DEBUG_FORCE_LOSE` for testing purposes.
- `DoorManager.ts`: Manages the state (Open, Closed, Locked, Destroyed) and logic of doors.
- `EnemyManager.ts`: Manages the lifecycle and state updates for all enemy units. Handles scrap rewards for elite kills and processes landmine explosions when enemies enter cells containing mines.
- `ItemEffectService.ts`: Specialized service that implements the `ItemEffectHandler` interface. It is responsible for executing the effects of consumable items (Heal, Grenade, Scanner, Mine, Sentry) and mutating the game state accordingly.
- `ItemDistributionService.ts`: Handles opportunistic pickup logic and item assignments to units. Manages a spatial grid of visible loot and objectives to resolve competition between capable units. Now utilizes `MapUtils.resolveObjectivePosition` to centralize objective world-position resolution.
- `LootManager.ts`: Manages spawning and despawning of dropped items (loot) on the map.
- `MetaManager.ts`: Deprecated. Re-exports `MetaManager` from `src/engine/campaign/` for backward compatibility.
- `MissionManager.ts`: Handles mission-specific setup, objective tracking, scrap reward calculation, and win/loss conditions. Supports special logic for `Boss` nodes (3 objectives, 3x scrap) and `Elite` nodes (2 objectives, 2x scrap), including specialized Hive/Recover mix. Enforces a maximum of 3 Data Disks for `RecoverIntel` missions by capping map-provided and procedurally generated objectives. Correctly handles `isRecoverMission` by excluding `MissionType.Default` when `nodeType` is present, ensuring map-based Recover objectives become optional loot in campaign combat nodes while maintaining legacy test support. Mission completion (Won/Lost) is deferred until all units are either extracted or dead, following a unified logic that validates `allObjectivesComplete` and respects survival/expendability requirements per mission type (ADR 0032). Uses `PlacementValidator` to ensure dynamic objectives do not overlap with existing map occupants.
- `MovementManager.ts`: Translates path data into position updates and handles door interactions. Refactored to handle any `IMovableEntity` (Units or Enemies) via a generic interface. Now maintains a `positionHistory` ring buffer (last 6 cells) for units to support anti-backtracking AI rules (Spec 2.0). **ADR 0056:** Implements path-blocked invalidation triggers when a unit cannot reach its next cell (e.g., door locked).
- `StatsManager.ts`: Calculates derived stats (Speed, HP, Accuracy) from base archetypes, equipment, and status effects.
- `TurretManager.ts`: Manages the lifecycle and combat logic for deployable sentry turrets. Automatically targets and shoots visible enemies within range.
- `UnitAI.ts`: Implements autonomous decision-making for units via a sequence of `Behavior` objects. Both `UnitAI` and its `Behavior`s follow an immutable pattern where each evaluation returns an updated `Unit` reference and a `handled` flag, ensuring AI-driven state changes (like new commands or target updates) are correctly propagated through the engine's structural sharing architecture. Includes VIP behaviors, retreat logic, opportunistic loot/objective pickup (respecting distance-based assignments), and map exploration. Coordinates with `VipAI` for specialized unit behaviors. Implements a plan-then-execute commitment guard (ADR 0056) that prevents same-or-lower priority behaviors from interrupting an active plan until it expires or is invalidated. **Fix:** Now includes a 'zombie' move cleanup that resets units to `Idle` when an active plan has expired or been invalidated but the unit is still moving without an exploration target.
- `UnitManager.ts`: Orchestrates the lifecycle, movement, combat, and AI updates for soldier units. Delegates combat to `CombatManager`, stats calculation to `StatsManager`, movement updates to `MovementManager`, command execution to `CommandExecutor`, autonomous decision-making to `UnitAI`, item distribution to `ItemDistributionService`, and unit state/channeling to `UnitStateManager`. The update loop utilizes an immutable pattern (`state.units.map()`), consuming return values from all specialized managers and the AI system to ensure consistent state updates through structural sharing. Handles loot interaction, `PICKUP` and `USE_ITEM` commands, and attributes kills to individual units for XP calculation. Supports autonomous "Sticky Target" logic where soldiers prioritize threats using a heuristic (`Score = (MaxHP - CurrentHP) + (100 / Distance)`) and maintain focus on a target until it dies or leaves range/LOF. Supports the `ESCORT_UNIT` command with dynamic formation logic (Vanguard, Rearguard, Bodyguard roles) and speed synchronization to ensure escorts keep pace with their target. `USE_ITEM`, `PICKUP`, and `EXTRACT` commands can be channeled, during which the unit is stationary until the action completes. Manual commands issued to units (except `EXPLORE` or `RESUME_AI`) automatically disable autonomous behavior (`aiEnabled = false`) to ensure user orders take priority over autonomous exploration. **ADR 0056:** Orchestrates plan invalidation triggers including new enemy LOS, all enemies dead, low HP (\<25%), new area revealed, objective state changes, and natural goal completion.
- `UnitStateManager.ts`: Handles unit state transitions, including command queue processing and the progress/completion of timed channeling actions (Extract, Collect, Pickup, UseItem).
- `UnitSpawner.ts`: Handles the initial spawning of soldiers and VIPs on the map. Supports deterministic placement for the manual deployment phase by optionally disabling randomization.
- `VisibilityManager.ts`: Manages fog-of-war and unit line-of-sight updates.
- `placeholder.ts`: A placeholder file, possibly for future managers or as a template.

## Functionality

- **Unit & Enemy Management**: `UnitManager` and `EnemyManager` handle movement and combat logic, including hit chance calculations based on the new Weapon/Aim model (`HitChance = ((SoldierAim + WeaponMod + EquipmentBonus) / 100) * (WeaponEffectiveRange / Distance)`). `UnitManager` delegates to `CombatManager` for target acquisition, autonomous weapon switching between melee and ranged weapons based on target distance, and attack execution. It delegates to `StatsManager` for dynamic stat recalculation (applying bonuses from equipment and burdens from carried objectives). Movement updates are delegated to `MovementManager`. Autonomous behaviors and exploration logic are delegated to `UnitAI`. State transitions and channeling are handled by `UnitStateManager`.
- **Infinite Sight**: Soldiers have infinite sight range by default, managed via `VisibilityManager`.
- **Unified Pacing**: Managers follow the global `scaledDt` to ensure that movement, threat growth, and timed actions (like extraction) scale consistently with the game speed setting. This ensures that pausing the game freezes all simulation logic.
- **Honest Difficulty (Prologue)**: Implements ADR 0057. The prologue uses reduced enemy stats and removes the hard HP clamp. If a soldier's HP reaches 0, a scripted rescue (handled in `CoreEngine`) heals them to 50% HP and increments the `prologueRescues` counter, allowing the mission to continue without invulnerability.

## Subdirectories

- `tests/`: Tests for various engine managers.

## Connections

- All managers are instantiated and orchestrated by `src/engine/CoreEngine.ts`.
- They frequently interact with each other (e.g., `UnitManager` uses `VisibilityManager` and `DoorManager`).

## Related ADRs

- [ADR 0006: Autonomous Agent Architecture](../../../docs/adr/0006-autonomous-agent-architecture.md)
- [ADR 0007: Command Pattern & Queue](../../../docs/adr/0007-command-pattern-queue.md)
- [ADR 0010: Unit System Architecture](../../../docs/adr/0010-unit-system-architecture.md)
