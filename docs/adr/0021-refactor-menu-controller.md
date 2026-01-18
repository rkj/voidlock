# ADR 0021: Refactor MenuController (Extract Overlay Logic)

## Status
Accepted

## Context
The `src/renderer/MenuController.ts` file manages the tactical menu state machine. However, it also contains significant logic for generating visual overlays (`generateTargetOverlay`) based on the current command context (Cells, Items, Units, Intersections). This logic is coupled with the menu state management and violates SRP.

## Decision
We will extract the overlay generation logic into a dedicated helper or strategy.

### Changes
1.  **Create `src/renderer/controllers/TargetOverlayGenerator.ts`** (or similar):
    *   Move the `generateTargetOverlay` logic here.
    *   It should accept the `GameState` and the `CommandType` (or filter criteria) and return the list of `OverlayOption`s.
2.  **Update `MenuController.ts`**:
    *   Delegate to `TargetOverlayGenerator`.
    *   Focus on input handling and state transitions.

## Consequences
*   **Positive**: `MenuController` becomes a pure coordinator. Overlay logic can be unit tested without mocking the entire menu system.
*   **Negative**: Need to pass state between controller and generator.
