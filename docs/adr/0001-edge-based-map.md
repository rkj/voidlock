# ADR 0001: Edge-Based Map Architecture

**Status:** Implemented / In Progress

## Context
The initial `MapDefinition` relied on `Cell` objects containing `walls` (n, e, s, w) and `Door` objects containing `segment` arrays. This led to data duplication (sync issues) and ambiguity in coordinate systems.

## Solution
Transition to a **Graph of Cells with Shared Boundaries**.

### Runtime Architecture (`GameGrid`)

At runtime, the `GameGrid` hydrates the static data into a graph structure:

1.  **`Cell` Object**:
    - Coordinates: `x, y`.
    - `edges`: `{ N: Boundary | null, E: ..., S: ..., W: ... }`.
    - If `edges[dir]` is `null`, the path is open.

2.  **`Boundary` Object**:
    - **Shared Instance**: The boundary between `Cell(0,0)` and `Cell(1,0)` is a _single object_ referenced by `Cell(0,0).edges.E` and `Cell(1,0).edges.W`.
    - Properties: `type` ('Wall', 'Door'), `state` (Open/Closed), `hp`.
    - **Benefit**: Changing state on one side immediately affects the other.

### Data persistence (`MapDefinition`)

The serialized JSON format remains simple but unambiguous:

- **Cells**: List of floor cells.
- **Edges**: List of active boundaries (Walls/Doors).
  - Key: `x1,y1|x2,y2` (Canonical sorted key).
  - Value: Properties (Type, HP, etc).
- **Legacy Support**: `GameGrid` can initially hydrate from the old format by creating Boundaries where `cell.walls[dir]` is true or `door.segment` matches.

### Implementation Plan

1.  **Hydration**: `GameGrid` constructor iterates cells and creates `Boundary` objects, storing them in a `Map<EdgeKey, Boundary>` to ensure uniqueness/sharing.
2.  **Pathfinding/LOS**: Updated to traverse the Graph. `canMove` becomes `!cell.edges[dir]?.blocking`.
3.  **Generators**: Can eventually be updated to produce Edge Lists directly, but can currently produce the old format which `GameGrid` sanitizes during hydration.
