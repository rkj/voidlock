# ADR 0041: AI Verification & Test Strategy

## Status
Accepted

## Context
The current AI implementation suffers from "drift" and inefficiency: units wander when they should extract, cluster in the same room instead of exploring efficiently, and ignore objectives. Existing tests are often "happy path" checks or rely on complex generated maps, making it difficult to isolate specific decision-making failures.

We need a standardized, comprehensive testing strategy to verify:
1.  **Discipline:** Adherence to high-priority overrides (Extraction > Combat).
2.  **Coordination:** Efficient partitioning of the map among multiple agents.
3.  **Opportunism:** Balancing main goals with low-cost secondary gains (Loot).

## Decision

We will adopt a **Micro-World Deterministic Testing** strategy for all AI behaviors. This involves creating specific, minimal, hardcoded map layouts that force the AI into specific decision points.

### 1. Test Architecture

*   **Micro-Maps:** Tests MUST NOT use map generators. They must use hand-crafted `MapDefinition` literals (JSON) defining the exact topology needed (e.g., a Y-junction, a long corridor, a U-shape).
*   **Deterministic State:** All tests run in the deterministic `CoreEngine` loop. We rely on `state.t` (ticks) to measure efficiency.
*   **Telemetry:** Verification is performed by analyzing the `GameState` history, specifically:
    *   `unit.pos` history (Trail analysis).
    *   `state.discoveredCells` (Coverage rate).
    *   `unit.activeCommand` (Intent verification).

### 2. Mandatory Test Scenarios

All AI refactors must pass the following canonical scenarios:

#### A. The "Burning Building" (Extraction Discipline)
*   **Scenario:** A unit is ordered to `EXTRACT`. An enemy is spawned *behind* them or to the side, dealing damage.
*   **Map:** 1x10 Corridor. Unit at `(0,0)`, Extraction at `(9,0)`. Enemy at `(0,2)`.
*   **Success Condition:**
    *   Unit moves strictly towards `(9,0)`.
    *   Distance to Extraction decreases monotonically (or stays flat if blocked).
    *   Unit does NOT switch to `ATTACK` or `IDLE`.
*   **Failure:** Unit turns to fight, or wanders after killing the enemy.

#### B. The "Y-Split" (Coordinated Exploration)
*   **Scenario:** Two units start at the base of a Y-junction. Two unexplored rooms lie at the branches.
*   **Map:** A root corridor splitting into Room A and Room B.
*   **Success Condition:**
    *   By Tick $N$: Unit 1 is in Room A, Unit 2 is in Room B.
    *   **Zero Redundancy:** Unit 2 never enters Room A (unless Room B is fully explored).
    *   **State Check:** Verify `AIContext.explorationClaims` contains distinct targets for each unit.

#### C. The "Shiny Object" (Opportunistic Greed)
*   **Scenario:** A unit is exploring. A high-value objective/loot is visible but slightly off-path.
*   **Map:** 5x5 Room. Entry `(0,2)`, Exit `(4,2)`. Loot at `(2,0)`.
*   **Success Condition:**
    *   Unit path deviates to `(2,0)` to pickup.
    *   After pickup, unit resumes path to `(4,2)` or next unexplored area.
*   **Failure:** Unit ignores loot to rush the door, or unit picks up loot and then goes Idle.

#### D. The "Efficiency Ratio" (Step Count)
*   **Scenario:** Explore a fixed grid.
*   **Metric:** `Ratio = UniqueCellsDiscovered / TotalStepsTaken`.
*   **Constraint:** Ratio must remain above a defined threshold (e.g., > 0.8 for open maps). A Ratio < 0.5 indicates excessive backtracking ("The Roomba Problem").

### 3. Implementation Guidelines

*   **No Mocks:** Tests run against the real `CoreEngine` and `UnitAI`.
*   **Step-by-Step:** Use `engine.update(tick)` to step through critical decision frames.
*   **Snapshotting:** Tests should log the sequence of `unit.pos` to visualize the path on failure.

## Consequences

*   **Higher Upfront Cost:** Writing micro-maps is more tedious than using generators.
*   **Brittle to Pathfinding Changes:** Changes to the A* heuristic might alter exact paths, requiring test updates.
*   **High Confidence:** Passing these tests guarantees the specific behaviors (Discipline, Coordination) are working as designed.
