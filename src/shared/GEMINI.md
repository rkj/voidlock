# src/shared

This directory contains types, constants, and utilities that are shared between the `engine` (running in a Web Worker) and the `renderer` (running in the main thread).

## Files

- `types.ts`: The central location for all shared interfaces, enums, and type definitions (e.g., `GameState`, `Unit`, `MapDefinition`, `Command`, `Weapon`, `Item`). `MapDefinition` includes `generatorName` to track the origin of the map. `Unit` tracks stats including `kills`, `damageDealt`, and `objectivesCompleted`. `MissionStats` tracks mission progress including `aliensKilled`, `elitesKilled`, and `scrapGained`. `GameState` and `Unit` use sub-objects (e.g., `stats`, `settings`) to group related properties for easier management and test mocking. `Weapon` and `Item` types include a `description` field for UI tooltips. Includes `TileDefinition`, `TileAssembly`, and related types for the Space Hulk map importer. `BoundaryType` enum (`Open`, `Wall`, `Door`) is used by `BoundaryDefinition` and `Graph` to define edge properties.
- `campaign_types.ts`: Interfaces and types specifically for the persistent campaign mode (e.g., `CampaignDifficulty`, `CampaignState`, `CampaignSoldier`, `CampaignNode`, `GameRules`, `MissionReport`). `CampaignState` includes a `status` field to track overall campaign outcome ("Active", "Victory", "Defeat"). `GameRules` includes `allowTacticalPause` to restrict Active Pause in higher difficulties. Includes progression constants (`XP_THRESHOLDS`, `STAT_BOOSTS`) and leveling logic (`calculateLevel`).
- `PRNG.ts`: A deterministic Pseudo-Random Number Generator implementation.

## Subdirectories

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
