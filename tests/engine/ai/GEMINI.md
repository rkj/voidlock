# src/engine/tests/ai

Tests for autonomous behavior logic. Includes tests for exploration, objective prioritization, and specific AI archetypes (Enemy, Soldier, RangedKite).

## Files

- `EnemyAI.test.ts`: Tests for standard enemy archetypes.
- `RangedKiteAI.test.ts`: Tests for specialized kiting behavior.
- `VipAI.test.ts`: Tests for VIP movement and escort interaction.
- `SoldierCoreAI.test.ts`, `SoldierExplorationAI.test.ts`: Tests for autonomous soldier behaviors.
- `CoordinatedExploration.test.ts`, `CoordinatedObjectives.test.ts`: Tests for multi-unit coordination.

## Related ADRs

- [ADR 0006: Autonomous Agent Architecture](../../../../docs/adr/0006-autonomous-agent-architecture.md)
