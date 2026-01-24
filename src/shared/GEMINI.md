# src/shared

This directory contains types, constants, and utilities that are shared between the `engine` (running in a Web Worker) and the `renderer` (running in the main thread).

## Files

- `types.ts`: A barrel file that re-exports all shared interfaces, enums, and type definitions from the `types/` directory and `campaign_types.ts`. Maintained for backward compatibility.
- `campaign_types.ts`: Interfaces and types specifically for the persistent campaign mode.
- `PRNG.ts`: A deterministic Pseudo-Random Number Generator implementation.
- `VisibilityUtils.ts`: Optimized utilities for visibility and discovery checks using bitsets.

## Subdirectories

- `types/`: Modular directory-based type system (ADR 0015).
- `tests/`: Comprehensive test suite for shared components.

## Functionality

- **Weapon & Item Systems**: Defines `WeaponLibrary` and `ItemLibrary`, supporting units with various equipment. Accuracy is handled via a percentage-based modifier model (`soldierAim + weapon.accuracy + equipmentAccuracyBonus`). Items can provide passive bonuses (HP, Speed, Accuracy) or active abilities (Heal, Grenade, Mine). Active items may require `channelTime` (e.g., Medkit, Mine), during which the unit enters a `Channeling` state.
- **Type Safety**: Provides a common language for both threads to ensure data consistency.
- **Protocol Definition**: The types here define the contract for the JSON observation/command protocol.
- **Determinism**: The `PRNG` ensures that given the same seed, both the engine and any replays produce the same results.

## Connections

- Imported by almost every other file in the project.
- Critical for the communication between `src/engine/GameClient.ts` and `src/engine/worker.ts`.

## Related ADRs

- [ADR 0006: Autonomous Agent Architecture](../docs/adr/0006-autonomous-agent-architecture.md)
- [ADR 0007: Command Pattern & Queue](../docs/adr/0007-command-pattern-queue.md)
