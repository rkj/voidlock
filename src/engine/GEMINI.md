# src/engine

This directory contains the core simulation logic for Voidlock. It follows a deterministic, tick-based approach.

## Files

- `CoreEngine.ts`: The main orchestrator of the game simulation. It manages state (including `isPaused`, `timeScale`, and `isSlowMotion`), initializes managers, and runs the game loop. It respects `allowTacticalPause`, enforcing minimum speed of 1.0x (except for absolute pause) when disabled. Now supports node-type specific mission setup (e.g., Boss/Elite nodes) and includes a catch-up phase for session recovery. **Optimization:** State serialization now omits large static map data (cells, walls) after the first send, but always includes critical mission entities (spawnPoints, objectives) to ensure authoritative visibility (ADR 0032). Uses a bitset for visibility/discovery to reduce GC pressure.
- `Director.ts`: Manages enemy spawning based on threat levels and timers. Also handles global commander abilities (Grenades, Scanners) and unit items (Medkits, Stimpacks - restricted to self-heal).
- `GameClient.ts`: Provides an interface for the renderer (main thread) to communicate with the engine (worker). Exposes typed methods for debug actions (overlays, state queries) and handles time scaling, including Active Pause (0.05x). Now implements mission auto-save for crash recovery, persisting both the command log and the current engine tick to `localStorage`.
- `GameGrid.ts`: Manages the logical grid, including walkability and movement validation between cells (respecting walls and doors).
- `Graph.ts`: Represents the map as a graph of cells and boundaries (walls/doors). Supports sparse initialization from `MapDefinition` and authoritative hydration from `boundaries` array. Hydrates `walls` from corner-to-corner geometric segments.
- `LineOfSight.ts`: Handles LOS and LOF (Line of Fire) calculations between units and cells. Implements geometric precision (ADR 0026), accounting for unit physical radius (`UNIT_RADIUS`) and door struts (outer 1/3 of boundary). LOS allows seeing through opening doors (if any ray passes), while LOF strictly requires doors to be fully open and the entire "fat" ray to be clear. Includes an optimization to allow instant LOF for units within the same 1x1 cell to avoid corner-clipping issues.
- `MapGenerator.ts`: Deprecated wrapper that re-exports `MapFactory` for backward compatibility. Use `@src/engine/map/MapFactory` for new code.

## Subdirectories

- `ai/`: Specialized AI logic for enemies and soldiers.
- `campaign/`: Specialized managers for the campaign mode logic.
- `config/`: Configuration files and constants (e.g., `GameConstants.ts`).
- `generators/`: Specific map generation algorithms (e.g., `SpaceshipGenerator`, `TreeShipGenerator`).
- `interfaces/`: Shared interfaces for breaking circular dependencies (e.g., `IDirector`).
- `map/`: Modular map generation system (Factory, Sanitizer, Validator).
- `managers/`: Modules that handle specific aspects of the game (Unit, Enemy, Door, Visibility, Mission, Command).
- `persistence/`: Logic for saving and loading game state.

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
- [ADR 0026: Geometric LOS and LOF Precision](../docs/adr/0026-geometric-los-lof-precision.md)
