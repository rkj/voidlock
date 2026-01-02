# ADR 0006: Autonomous Agent Architecture

**Status:** Implemented

## Context

Xenopurge requires a robust system for autonomous units—both friendly soldiers and enemy aliens—to operate effectively in a real-time tactical environment. The system must support complex behaviors like threat assessment, exploration, and objective coordination, while maintaining simulation determinism and efficient tick synchronization.

## Solution

The architecture decentralizes AI logic into specialized managers and profile-based decision trees, integrated into the core simulation loop.

### 1. `AIProfile` System

Every unit is assigned an `AIProfile` that dictates its innate behavioral response to threats when not under direct manual control.

-   **`STAND_GROUND`**: The unit remains in position, attacking any enemies within range but refusing to move to engage or retreat.
-   **`RUSH`**: The unit aggressively closes distance with the nearest threat to minimize engagement range.
-   **`RETREAT`**: The unit attempts to maximize distance from threats while maintaining line of sight/fire, transitioning to a "flee" state if enemies get too close.
-   **`ENGAGE` (Default)**: A balanced profile that maintains optimal range and pursues threats if they move out of range.

### 2. Autonomous Behaviors

Units (primarily soldiers) follow a prioritized decision tree:
1.  **Threat Evaluation**: Continuous scanning for visible enemies using Line of Sight (LOS).
2.  **Objective Acquisition**: Coordinated claiming of pending objectives (e.g., retrieving artifacts). Units communicate to ensure multiple agents don't target the same objective.
3.  **Exploration**: Autonomous pathfinding to the closest undiscovered floor cells.
4.  **Extraction**: Once all objectives are complete, agents automatically navigate to the extraction zone.

### 3. Enemy AI Archetypes

Enemy behavior is managed via the `IEnemyAI` strategy interface:
-   **`SwarmMeleeAI`**: Prioritizes closing distance for melee attacks; roams randomly when no soldiers are detected.
-   **`RangedKiteAI`**: Maintains optimal distance from soldiers, kiting backwards when approached while continuing to fire.

### 4. Simulation Tick Synchronization

AI logic is synchronized with the simulation clock to ensure deterministic results and performance:
-   **Per-Tick Updates**: Movement, attack cooling, and proximity-based state changes are processed every simulation tick (`dt`).
-   **Throttled Decision Making**: Expensive operations like pathfinding re-evaluation for exploration are throttled (e.g., every 1000ms) to conserve CPU cycles.
-   **Seeded PRNG**: All probabilistic decisions (hit chances, random roaming) use a seeded Pseudo-Random Number Generator, ensuring replayed missions are identical.

## Design Principles

-   **Determinism**: Mandatory for replay systems and debugging.
-   **Coordination**: Agents share state (e.g., `claimedObjectives`) to prevent redundant actions.
-   **Reactivity**: Agents must respond immediately to LOS changes or damage, even if their throttled high-level task hasn't ticked.

## References

-   [AI & Game Logic Specification](../../spec/ai.md)
-   `src/engine/managers/UnitManager.ts`: Implementation of soldier logic.
-   `src/engine/managers/EnemyManager.ts`: Implementation of enemy archetypes.
-   `src/engine/CoreEngine.ts`: Orchestration of simulation ticks.
