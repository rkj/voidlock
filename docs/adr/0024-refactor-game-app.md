# ADR 0024: Refactor GameApp (Extract SquadBuilder)

## Status

Accepted

## Context

`src/renderer/app/GameApp.ts` is the application root (~1200 lines). It contains a massive `renderSquadBuilder` method that constructs DOM elements manually for the squad selection screen. It also handles mission launching configuration.

## Decision

We will extract the Squad Builder UI and Mission Logic.

### Changes

1.  **Create `src/renderer/components/SquadBuilder.ts`**:
    - Move `renderSquadBuilder` and its helper logic here.
    - Manage the drag-and-drop logic internally.
2.  **Update `GameApp.ts`**:
    - Instantiate `SquadBuilder` and mount it to the DOM.
    - Pass necessary callbacks for squad updates.

## Consequences

- **Positive**: `GameApp` shrinks significantly. Squad Builder UI logic is isolated from the application lifecycle.
- **Negative**: Need to define clear interfaces for interaction between App and SquadBuilder.
