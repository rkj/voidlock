# ADR 0054: Unified Entity Movement

## Status
Accepted

## Context
Currently, `MovementManager` handles soldier movement while `EnemyManager` handles enemy movement using nearly identical logic for path following, distance checks, and position updates. This duplication is a maintenance risk.

## Decision
We will unify entity movement logic into a shared system.

### 1. MovementManager Generalization
The `MovementManager` will be refactored to handle any `IMovableEntity` (Units and Enemies). 

### 2. Shared Physics
A shared utility or base class will be used to ensure movement physics (speed normalization, cell snapping, door waiting) are consistent across all entity types.

## Consequences
- **Positive:** Single source of truth for movement logic. Easier to implement global movement changes (e.g. slowing all units).
- **Negative:** Requires refactoring both `UnitManager` and `EnemyManager` to use the unified system.
