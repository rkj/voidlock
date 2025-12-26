# src/engine/tests

This directory contains the automated test suite for the game engine, using Vitest.

## Files

- Numerous `.test.ts` files covering core engine components like `CoreEngine`, `GameGrid`, `LineOfSight`, `MapGenerator`, `Pathfinder`, etc.

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
