# Xenopurge Architecture

## Overview

Xenopurge is a tactical squad-based game engine designed with a strict separation of concerns between the core simulation logic, the rendering layer, and the content generation. The architecture follows a client-server model (where the "server" is a Web Worker) to ensure deterministic execution and responsive UI.

## Core Modules

### 1. Engine (`src/engine/`)

The heart of the game. It runs deterministically given a seed and a command stream.

- **`CoreEngine`**: The main simulation controller. It maintains the `GameState`, processes `Commands`, and advances the simulation tick by tick. It allows for "Pause", "Resume", and discrete time steps.
- **`GameGrid`**: Represents the physical world as a **Graph of Cells with Shared Boundaries**.
  - **Cells**: Represent floor tiles with coordinates `(x, y)`.
  - **Boundaries**: Shared objects between adjacent cells (Walls, Doors). A single `Boundary` instance is referenced by both neighbors (e.g., `Cell(0,0).edges.E` and `Cell(1,0).edges.W`). This ensures state consistency (e.g., opening a door affects both sides immediately).
  - It handles collision detection (`canMove`), wall states, and door interactions, providing a queryable interface for the Pathfinder and LOS systems.
- **`Pathfinder`**: Implements pathfinding algorithms (A\*) on the `GameGrid`. It supports pathing through Open doors and planning paths through Closed doors (which units can then open).
- **`LineOfSight`**: Handles visibility calculations ("Fog of War"). It determines which cells are visible to the player's squad based on their position and blocking terrain (Walls, Closed Doors).
- **`Director`**: The AI logic that manages enemy spawning, pacing, and difficulty ramping. It monitors game state and injects events or enemies.
- **`GameClient`**: The bridge between the UI/Main Thread and the Engine Worker. It handles initializing the worker, sending commands, receiving state updates, and managing the Replay recording.

### 2. Generators (`src/engine/generators/`)

Procedural content generation modules.

- **`MapGenerator`**: Abstract base class for map generation strategies.
- **`TreeShipGenerator`**: Generates acyclic "Tree-like" spaceship layouts. It ensures connectivity and prevents loops, prioritizing a "forward-moving" tactical experience.
- **`SpaceshipGenerator`**: Generates dense, interconnected spaceship interiors with rooms and corridors.
- **`DenseShipGenerator`**: Maximizes floor coverage (>90%) while maintaining a strict acyclic tree structure from a central spine.

### 3. AI System (`src/engine/ai/`)

Encapsulates decision-making logic for units and enemies.

- **`EnemyAI`**: Interface-based strategy pattern for different enemy behaviors.
  - **`SwarmMeleeAI`**: The default behavior for current hostiles. Roams the ship autonomously and aggressively pursues any detected soldiers for melee combat.

### 4. Renderer (`src/renderer/`)

Purely visual layer.

- **`Renderer`**: Renders the `GameState` to an HTML5 Canvas. It handles:
  - Grid visualization (Floor, Walls).
  - Entity rendering (Soldiers, Enemies).
  - Fog of War overlays (Visible, Discovered, Hidden).
  - Visual effects (Tracers, Highlights).
  - **Independence**: The Renderer has no game logic. It simply draws what the State tells it.

### 4. Shared (`src/shared/`)

Common definitions.

- **`types.ts`**: Contains all shared interfaces (`GameState`, `Command`, `MapDefinition`, `Unit`, etc.) ensuring type safety across the Worker boundary.
- **`PRNG`**: A seedable Pseudo-Random Number Generator to ensure determinism.

## Key Concepts

- **Determinism**: The engine is fully deterministic based on the initial `seed`. Replaying the same sequence of commands on the same seed produces the exact same game state.
- **Command Pattern**: All mutations to the game state happen via `Commands` (e.g., `MOVE_TO`, `OPEN_DOOR`). This facilitates networking, replays, and debugging.
- **Separation of Concerns**:
  - **Logic vs View**: Engine knows nothing about pixels. Renderer knows nothing about rules.
  - **Map vs Content**: The Map is a static grid definition. The Game State overlays dynamic entities (Units, Doors) on top of it.

## Communication Protocol (Worker Bridge)

The communication between the Main Thread (Renderer/UI) and the Engine Thread (Web Worker) is handled via a JSON-based protocol using `postMessage`.

### 1. Main Thread -> Worker (`WorkerMessage`)

Sent via `GameClient`.

- **`INIT`**: Initializes the `CoreEngine`.
  - _Payload_: `{ seed, map, fogOfWarEnabled, debugOverlayEnabled, agentControlEnabled, squadConfig, missionType }`
- **`COMMAND`**: Issues a tactical command to units.
  - _Payload_: A `Command` object (e.g., `MOVE_TO`, `ATTACK_TARGET`, `SET_ENGAGEMENT`).
- **`QUERY_STATE`**: Explicitly requests a state update.

### 2. Worker -> Main Thread (`MainMessage`)

Received by `GameClient` and passed to the `Renderer`.

- **`STATE_UPDATE`**: Provides a full snapshot of the simulation state.
  - _Payload_: `GameState` object.
  - _Frequency_: Sent every 100ms (as defined by `TICK_RATE` in `worker.ts`).
- **`EVENT`**: Asynchronous events (e.g., sound events, combat logs).
  - _Payload_: Event data.

### 3. State Synchronization

The simulation runs at a fixed 100ms tick rate. The `CoreEngine` maintains the authoritative `GameState`. Every tick, a deep-clone or immutable snapshot of this state is sent to the Main Thread. The Renderer is "dumb" and simply renders the latest snapshot received.

## Determinism & Simulation

Xenopurge achieves strict determinism through a fixed-step simulation loop and a seeded Pseudo-Random Number Generator (PRNG).

### 1. Deterministic Tick Loop

The simulation logic resides in the `CoreEngine.update(dt)` method.

- **Fixed Timestep**: The simulation is advanced in discrete intervals (default `dt = 100ms`).
- **Execution Order**: Each tick follows a strict execution sequence:
  1. **Director Update**: Evaluates spawn timers and spawns new enemies.
  1. **Environmental Logic**: Updates door states and timers.
  1. **Visibility Logic**: Re-calculates Line of Sight for all active units.
  1. **Unit Logic**:
     - Threat evaluation.
     - Self-preservation (Retreat/Group Up).
     - Autonomous exploration or command execution.
  1. **Movement Resolution**: Interpolates unit positions based on speed and path.
  1. **Combat Resolution**: Calculates damage based on weapons and line of sight.
- **Side-Effect Free**: The engine logic does not rely on any external state or non-deterministic APIs (like `Date.now()` or `Math.random()`).

### 2. Pseudo-Random Number Generator (PRNG)

- **Algorithm**: A simple Linear Congruential Generator (LCG) implemented in `src/shared/PRNG.ts`.
- **Seeding**: The `CoreEngine` is initialized with a `seed` (integer). This seed is used to instantiate the `PRNG`.
- **Usage**: The `PRNG` is used for all probabilistic events:
  - Enemy spawn locations and types (via the `Director`).
  - Selection of objective locations.
  - Initial unit placement jitter.
  - Combat hit/miss probability (if implemented).
- **Shared Instance**: The `CoreEngine` owns the `PRNG` instance and passes it to sub-modules like the `Director` to ensure they stay in sync with the primary simulation thread.

### 3. Replayability

Because the simulation is deterministic, a complete game session can be perfectly reconstructed using only:

1. The initial **Seed**.
1. The **Map Definition**.
1. The **Command Stream** (a timestamped log of all user inputs sent to the engine).

## Testing Strategy

- **Unit Tests**: Core mechanics (`Pathfinder`, `GameGrid`, `CycleDetection`) are tested in isolation.
- **Generator Tests**: Generators are tested for properties (e.g., "Acyclicity") rather than specific pixel layouts, ensuring structural correctness.
