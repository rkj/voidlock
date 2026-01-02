# src/shared

This directory contains types, constants, and utilities that are shared between the `engine` (running in a Web Worker) and the `renderer` (running in the main thread).

## Files

- `types.ts`: The central location for all shared interfaces, enums, and type definitions (e.g., `GameState`, `Unit`, `MapDefinition`, `Command`, `Weapon`). `MissionStats` tracks mission progress including `aliensKilled`, `elitesKilled`, and `scrapGained`. `GameState` and `Unit` use sub-objects (e.g., `stats`, `settings`) to group related properties for easier management and test mocking. `Weapon` and `Item` types include a `description` field for UI tooltips.
- `campaign_types.ts`: Interfaces and types specifically for the persistent campaign mode (e.g., `CampaignState`, `CampaignSoldier`, `CampaignNode`, `GameRules`, `MissionReport`).
- `PRNG.ts`: A deterministic Pseudo-Random Number Generator implementation.

## Functionality

- **Weapon System**: Defines `Weapon` and `WeaponLibrary`, supporting units carrying both melee and ranged weapons. Accuracy is handled via a percentage-based modifier model (`soldierAim + weapon.accuracy + equipmentAccuracyBonus`).
- **Type Safety**: Provides a common language for both threads to ensure data consistency.
- **Protocol Definition**: The types here define the contract for the JSON observation/command protocol.
- **Determinism**: The `PRNG` ensures that given the same seed, both the engine and any replays produce the same results.

## Connections

- Imported by almost every other file in the project.
- Critical for the communication between `src/engine/GameClient.ts` and `src/engine/worker.ts`.
