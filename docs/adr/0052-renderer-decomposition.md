# ADR 0052: Renderer Decomposition Strategy

## Status

Accepted

## Context

As of March 2026 (v0.142.4), several classes in the renderer layer have grown beyond manageable sizes (800+ lines).

- `HUDManager` has 10+ distinct responsibilities including DOM management, state machines, and rendering logic for various panels.
- `InputManager` has a constructor with 20 parameters, causing maintenance difficulties and high coupling.
- `MenuController` has complex switch-based rendering logic in its primary state update methods.

This creates a high maintenance burden and makes the codebase fragile during refactors (e.g. the recent TSX migration regressions).

## Decision

We will systematically decompose these "God Classes" into smaller, specialized components following the Single Responsibility Principle (SRP).

### 1. HUDManager Decomposition

The `HUDManager` will be refactored into a coordinator that delegates to specialized panel classes:

- `DeploymentPanel`: Handles deployment UI and drag-and-drop interaction.
- `CommandMenuPanel`: Renders the context menu based on tactical state.
- `ObjectivesPanel`: Manages the objective list display.
- `EnemyIntelPanel`: Renders the enemy status overlay.
- `SoldierListPanel`: Manages the unit roster/HUD list.
- `GameOverPanel`: Handles the end-mission summary.

### 2. Constructor Configuration Objects

Classes with excessive constructor parameters (e.g., `InputManager`) will be refactored to use `Config` objects. This improves readability and simplifies adding or removing dependencies.

### 3. Logic Unification (DRY)

Common patterns in the renderer (spawn point validation, movement physics, entity selection) will be extracted to shared utilities in `src/shared/utils/`.

## Consequences

- **Positive:** Improved testability of individual components, easier maintenance, and better architectural clarity.
- **Negative:** Minor initial overhead in wiring components via DI.
- **Neutral:** No impact on game performance or behavior.
