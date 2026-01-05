# src/engine/tests

This directory contains the automated test suite for the game engine, using Vitest.

## Files

- Numerous `.test.ts` files covering core engine components like `CoreEngine`, `GameGrid`, `LineOfSight`, `MapGenerator`, `Pathfinder`, etc.
- `MissionWinConditions.test.ts`: Verifies win/loss scenarios for all mission types (Intel, Hive, Artifact, VIP).
- `regression_mplv_objective_ignored.test.ts`: Fix for soldiers ignoring visible objectives during exploration.
- `regression_mplv_accidental_claim.test.ts`: Specific case where exploration target overlaps objective.
- `regression_mplv_escort_ignored.test.ts`: Fix for Escort objectives being ignored by autonomous AI.
- `regression_awkp_item_targeting.test.ts`: Verifies item targeting logic (Grenades vs Medkits) and unit-based targeting for USE_ITEM.
- `regression_0rdj_initial_equipment.test.ts`: Fix for initial roster missing equipment.

## Subdirectories

- `ai/`: Tests for unit and enemy AI behaviors.
- `combat/`: Tests for combat resolution and shooting mechanics.
- `commands/`: Tests for command processing and queuing.
- `generators/`: Tests for various map generators, including regression tests with snapshots.
- `mapgen/`: Tests for map validation and assembly.
- `movement/`: Tests for movement logic, including door interactions.
- `objectives/`: Tests for mission objectives (e.g., Escort VIP).
- `repro/`: Repro cases for reported bugs or edge cases.
- `utils/`: Utility functions for writing tests (e.g., graph manipulation).

## Functionality

- **Regression Testing**: Ensures new changes don't break existing functionality.
- **TDD Support**: Provides a framework for writing tests before implementation.
- **Micro-Maps**: Many tests use small, hardcoded maps (e.g., 2x2) to isolate specific behaviors.

## Connections

- Tests components in `src/engine/`.
- Depends on `src/shared/types.ts` and `src/shared/PRNG.ts`.

## Related ADRs

- [ADR 0006: Autonomous Agent Architecture](../../../docs/adr/0006-autonomous-agent-architecture.md)
- [ADR 0007: Command Pattern & Queue](../../../docs/adr/0007-command-pattern-queue.md)
