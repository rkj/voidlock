# src/engine/ai

This directory contains autonomous behavior logic for both enemies and soldiers.

## Files

- `EnemyAI.ts`: Implements logic for standard enemy archetypes (roaming, chasing, attacking).
- `RangedKiteAI.ts`: Specialized AI for ranged enemies (like Spitters) that try to maintain distance from targets.

## Functionality

- **Decision Making**: AI determines unit actions based on the current `WorldState` and their specific archetype.
- **Pathing**: Leverages `Pathfinder` to navigate toward targets or exploration goals.
- **Policies**: Supports different engagement policies (e.g., `ENGAGE` vs `IGNORE`).

## Connections

- Used by `src/engine/managers/UnitManager.ts` and `src/engine/managers/EnemyManager.ts` to update unit intents during each tick.
- Depends on `src/engine/Pathfinder.ts` and `src/shared/types.ts`.
