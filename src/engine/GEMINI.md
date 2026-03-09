# src/engine

Core simulation logic for Voidlock. Deterministic, tick-based, runs in a Web Worker.

## Key Files

- `CoreEngine.ts`: Main orchestrator. Manages state, initializes managers, runs the game loop. Supports time scaling, visibility pruning, and state snapshots for replay.
- `Director.ts`: Enemy spawning based on threat levels and timers. Also handles global commander abilities and unit items. Supports MissionType-based suppression (e.g., Prologue).
- `GameClient.ts`: Main-thread bridge to the worker. Exposes typed methods for commands, debug actions, and time control.
- `GameGrid.ts`: Logical grid with walkability and movement validation (respects walls and doors).
- `Graph.ts`: Edge-based map representation — cells and boundaries (walls/doors) as first-class objects (ADR 0001).
- `LineOfSight.ts`: Geometric LOS/LOF raycasting with unit radius and door strut handling (ADR 0026).
- `Pathfinder.ts`: BFS pathfinding on the grid graph.

## Subdirectories

- `ai/`: Enemy AI strategies and unit behavior composition (ADR 0006, ADR 0056).
- `campaign/`: Campaign mode logic (events, roster, mission reconciliation).
- `config/`: Game constants and difficulty configuration.
- `generators/`: Map generation algorithms (TreeShip, DenseShip, SpaceshipGenerator, SectorMap).
- `interfaces/`: Shared interfaces to break circular dependencies (IDirector, AIContext).
- `managers/`: Domain-specific managers (Unit, Enemy, Door, Visibility, Combat, Movement, Command, Mission, Loot, Stats, Campaign).
- `map/`: Map processing pipeline (Factory, Sanitizer, Validator).
- `persistence/`: Save/load logic via StorageProvider abstraction.

## Architecture

- Deterministic: seeded PRNG, no `Math.random()`.
- Fixed-timestep loop with time scaling (0.1x to 10.0x).
- Communicates with main thread via JSON-based protocol (Commands/Observations).
- See `docs/ARCHITECTURE.md` for full system overview, relevant ADRs for specific decisions.
