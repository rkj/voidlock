# ADR 0017: Decoupled Menu Controller

## Context
The `src/renderer/MenuController.ts` class has become a "God Class" for the tactical UI. It currently manages:
1.  **UI State Machine:** Handling transitions between menus (Action -> Target -> Confirm).
2.  **Input Interpretation:** Deciding what a click on a specific cell means based on the current state.
3.  **Command Construction:** Building the JSON payload for the engine.
4.  **Selection State:** Tracking which unit is selected and what potential targets are valid.
5.  **Room Discovery:** Tracking the `discoveredRoomOrder`.

This coupling makes the UI logic brittle and hard to test.

## Decision
We will refactor `MenuController` into a composite set of classes in `src/renderer/controllers/`.

### Components
1.  **`MenuStateMachine`:**
    -   Manages the stack of menu states (`MenuState[]`).
    -   Handles transitions (`push`, `pop`, `reset`).
    -   Pure logic, no knowledge of the renderer.

2.  **`SelectionManager`:**
    -   Tracks the "Current Context": `selectedUnitId`, `hoveredCell`, `potentialTargets`.
    -   Responsible for validating if a selection is legal.

3.  **`CommandBuilder`:**
    -   Responsible for constructing the `Command` object.
    -   Accumulates parameters (`pendingAction`, `pendingTarget`) and emits the final command.

4.  **`RoomDiscoveryManager`:**
    -   Encapsulates the `cellToRoomId` and `discoveredRoomOrder` logic.

### Interaction
The `MenuController` (or a renamed `TacticalUIController`) will act as the facade that coordinates these components, but it will contain no business logic of its own.

## Consequences
-   **Positive:** Enables unit testing of complex UI flows (e.g., "Cancel targeting" logic) without a full DOM/Canvas environment.
-   **Negative:** Increased number of files. Requires careful coordination of state between the managers.
