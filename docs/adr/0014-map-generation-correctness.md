# ADR 0014: Map Generation Correctness & Grid Architecture

## Context

The game's map generator currently suffers from "soft-lock" bugs where rooms or objectives are generated in isolated, unreachable "islands". Previous attempts to fix this relied on validation-and-retry loops, which are inefficient and break the philosophy of deterministic generation. Additionally, the technical definition of the "Edge-Based Grid" was mixed into the functional specification, cluttering the product requirements.

## Decision

1.  **Constructive Correctness:** We will enforce a strict "Correct by Construction" requirement for all Map Generators.
    - Generators MUST use algorithms (e.g., Spanning Trees, Wave Function Collapse with reachability constraints, or iterative growth from a root) that guarantee graph connectivity mathematically.
    - "Generate and Validate" (Retry loops) are explicitly forbidden for core connectivity. The generator must produce a valid playable map in O(1) attempts.

2.  **Edge-Based Grid (Technical Definition):**
    - **Coordinate System:** `x` (Column), `y` (Row). Top-left is `0,0`.
    - **Adjacency:** Orthogonal only (North, South, East, West).
    - **Graph Architecture**:
      - **Cell**: Represents a floor tile or a Void (empty) tile.
      - **Boundary**: A shared object between two adjacent cells (e.g., the East edge of (0,0) is the same object as the West edge of (1,0)).
      - **State**: A Boundary can be a `Wall`, a `Door`, or `Open`. Changes to a Boundary (e.g. opening a door) instantly affect both adjacent cells.

3.  **Strict Entity Placement:**
    - Generators must maintain an index of "Occupied Rooms" to strictly enforce the mutually exclusive placement of Squad Spawns, Enemy Spawns, and Objectives (as defined in `spec/map.md` Section 8.5).

## Consequences

- **Positive:** Eliminates "broken map" bugs. Ensures instant, predictable loading times. Clarifies the distinction between "Product Spec" and "Tech Spec".
- **Negative:** Requires refactoring existing generators (`SpaceshipGenerator`) to abandon "random placement" strategies in favor of structured growth algorithms.
