# src/engine

This directory contains the core simulation logic for Xenopurge. It follows a deterministic, tick-based approach.

## Files

- `CoreEngine.ts`: The main orchestrator of the game simulation. It manages state, initializes managers, and runs the game loop.
- `Director.ts`: Manages enemy spawning based on threat levels and timers.
- `GameClient.ts`: Provides an interface for the renderer (main thread) to communicate with the engine (worker).
- `GameGrid.ts`: Manages the logical grid, including walkability and movement validation between cells (respecting walls and doors).
- `Graph.ts`: Represents the map as a graph of cells and boundaries (walls/doors).
- `LineOfSight.ts`: Handles LOS calculations between units and cells.
- `MapGenerator.ts`: Orchestrates map generation using various strategies.
- `Pathfinder.ts`: Implements A* pathfinding on the `Graph`, respecting door states.
- `worker.ts`: The Web Worker entry point that runs the `CoreEngine` loop.

## Subdirectories

- `ai/`: Specialized AI logic for enemies and soldiers.
- `generators/`: Specific map generation algorithms (e.g., `SpaceshipGenerator`, `TreeShipGenerator`).
- `managers/`: Modules that handle specific aspects of the game (Unit, Enemy, Door, Visibility, Mission, Command).
- `tests/`: Comprehensive test suite for the engine.

## Functionality

- **Deterministic Simulation**: The engine uses a seeded `PRNG` to ensure reproducible game runs.
- **Tick-based Loop**: The simulation progresses in discrete time steps (ticks). It supports time scaling (0.05x to 5.0x), with all game logic (movement, threat growth, timed actions) following the scaled game time. When the game is paused (timeScale = 0), the simulation stops updating completely.
- **Communication**: Communicates with the main thread via a JSON-based protocol (Observation/Command).

## Connections

- Depends on `src/shared/` for types and utilities.
- Used by `src/renderer/` to display the game state and send user commands.
- Leverages `src/content/` for map generation data.
