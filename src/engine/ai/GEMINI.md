# src/engine/ai

This directory contains autonomous behavior logic for both enemies and soldiers.

## Behaviors (Decomposed UnitAI)

The `UnitAI` manager has been decomposed into modular behavior classes located in `src/engine/ai/behaviors/`:

- `SafetyBehavior.ts`: Handles retreat (Low HP), grouping up (Isolated), and tactical kiting (Avoid mode) logic. Now enforces LOS maintenance during AVOID mode for standard units.
- `InteractionBehavior.ts`: Handles active interactions (Loot Pickup, Objective Collection, Extraction) when at target. Now enforces extraction priority by only auto-extracting autonomous units if the map is fully discovered or if an explicit EXTRACT command is given.
- `CombatBehavior.ts`: Handles engagement policies and tactical movement (Rush, Retreat, Stand Ground) during combat. Skips processing if unit is currently extracting or in AVOID mode (delegated to SafetyBehavior).
- `ObjectiveBehavior.ts`: Handles opportunistic and long-range pathfinding to loot, objectives, and extraction points. Now automatically issues a PICKUP command when at an objective target to prevent exploration distraction. Skips processing if unit is currently extracting.
- `ExplorationBehavior.ts`: Handles autonomous map discovery when no other tasks are prioritized. Skips processing if unit is currently extracting.
- `VipBehavior.ts`: Specialized AI for VIP units (Rescue and Escort/Flee logic).
- `Behavior.ts`: Common interface for all behavior classes.
- `BehaviorUtils.ts`: Shared utility functions for behaviors (distance calculations, exploration helpers).

## Files

- `EnemyAI.ts`: Implements logic for standard enemy archetypes (roaming, chasing, attacking).
- `RangedKiteAI.ts`: Specialized AI for ranged enemies (like Spitters) that try to maintain distance from targets.
- `VipAI.ts`: Core decision logic for VIP units, delegated to by `VipBehavior`. Now prioritizes absolute distance to extraction/safety when fleeing.

## Functionality

- **Decision Making**: AI determines unit actions based on the current `WorldState` and their specific archetype.
- **Pathing**: Leverages `Pathfinder` to navigate toward targets or exploration goals.
- **Policies**: Supports different engagement policies (e.g., `ENGAGE`, `IGNORE`, and `AVOID`). `AVOID` mode enables tactical kiting while maintaining line-of-sight. `IGNORE` mode allows firing while moving without engaging in tactical positioning.

## Connections

- Used by `src/engine/managers/UnitManager.ts` and `src/engine/managers/EnemyManager.ts` to update unit intents during each tick.
- Depends on `src/engine/Pathfinder.ts` and `src/shared/types.ts`.

## Related ADRs

- [ADR 0006: Autonomous Agent Architecture](../../../docs/adr/0006-autonomous-agent-architecture.md)
- [ADR 0023: Refactor UnitAI (Behavior Decomposition)](../../../docs/adr/0023-refactor-unit-ai.md)
