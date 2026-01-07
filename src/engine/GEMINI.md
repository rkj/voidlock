# src/engine

This directory contains the core simulation logic for Voidlock. It follows a deterministic, tick-based approach.

## Files

- `Constants.ts`: Global engine constants for simulation scaling and normalization (e.g., `SPEED_NORMALIZATION_CONST`).
- `CoreEngine.ts`: The main orchestrator of the game simulation. It manages state (including `isPaused`, `timeScale`, and `isSlowMotion`), initializes managers, and runs the game loop. It respects `allowTacticalPause`, enforcing minimum speed of 1.0x (except for absolute pause) when disabled. Now includes a catch-up phase for session recovery.
- `Director.ts`: Manages enemy spawning based on threat levels and timers. Also handles global commander abilities (Medkits, Stimpacks, Grenades, Scanners).
- `GameClient.ts`: Provides an interface for the renderer (main thread) to communicate with the engine (worker). Exposes typed methods for debug actions (overlays, state queries) and handles time scaling, including Active Pause (0.05x). Now implements mission auto-save for crash recovery.
- `GameGrid.ts`: Manages the logical grid, including walkability and movement validation between cells (respecting walls and doors).
- `Graph.ts`: Represents the map as a graph of cells and boundaries (walls/doors). Now supports sparse initialization from `MapDefinition`, implicitly treating missing cells as `Void`. Hydrates `walls` from corner-to-corner geometric segments.
- `LineOfSight.ts`: Handles LOS and LOF (Line of Fire) calculations between units and cells. LOS allows seeing through opening doors, while LOF strictly requires doors to be fully open.
- `MapGenerator.ts`: Orchestrates map generation using various strategies. Optimized JSON output by omitting `Void` cells. Now consistently produces corner-to-corner `WallDefinition` segments.
- `Pathfinder.ts`: Implements A\* pathfinding on the `Graph`, respecting door states.
- `worker.ts`: The Web Worker entry point that runs the `CoreEngine` loop.

## Engine Modes

The engine supports two modes defined in `EngineMode`:

- `Simulation`: Active gameplay where user commands are recorded and processed.
- `Replay`: Non-interactive playback of a `commandLog`, used for background replays during the mission debrief.

## Mission Replay

A mission run can be perfectly reproduced by re-initializing the engine with the same seed and the recorded `commandLog`. This is used to show a time-accelerated recap of the mission while the player reviews their stats.

## Subdirectories

- `ai/`: Specialized AI logic for enemies and soldiers.
- `generators/`: Specific map generation algorithms (e.g., `SpaceshipGenerator`, `TreeShipGenerator`).
- `managers/`: Modules that handle specific aspects of the game (Unit, Enemy, Door, Visibility, Mission, Command).
- `tests/`: Comprehensive test suite for the engine, including core components (`CoreEngine`, `GameGrid`, `Pathfinder`), and regression tests.
    - `regression_x81g_map_placement_fuzz.test.ts`: Fuzz test (100 seeds) verifying strict entity placement rules across varying map sizes (3x3 to 10x10).
    - `regression_v78_exposed_seed_mission.test.ts`: Verifies that `seed` and `missionType` are correctly exposed in the `GameState`.

## Testing Strategy

- **Deterministic Simulation**: The engine uses a seeded `PRNG` to ensure reproducible game runs.
- **Tick-based Loop**: The simulation progresses in discrete time steps (ticks). It supports time scaling (0.05x to 10.0x), with all game logic (movement, threat growth, timed actions) following the scaled game time. Active Pause (0.05x) allows commands to be issued while time moves slowly. When `allowTacticalPause` is disabled, time scaling below 1.0x is clamped to 1.0x.
- **Communication**: Communicates with the main thread via a JSON-based protocol (Observation/Command).

## Connections

- Depends on `src/shared/` for types and utilities.
- Used by `src/renderer/` to display the game state and send user commands.
- Leverages `src/content/` for map generation data.

## Related ADRs

- [ADR 0006: Autonomous Agent Architecture](../docs/adr/0006-autonomous-agent-architecture.md)
- [ADR 0007: Command Pattern & Queue](../docs/adr/0007-command-pattern-queue.md)
- [ADR 0008: Renderer & UI Separation](../docs/adr/0008-renderer-ui-separation.md)
- [ADR 0011: Standardized Unit Speed](../docs/adr/0011-standardized-unit-speed.md)
