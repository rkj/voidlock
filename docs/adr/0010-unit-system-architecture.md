# ADR 0010: Unit System Architecture

**Status:** Proposed

## Context

The `UnitManager` has become a monolithic class (over 1500 lines) with too many responsibilities. It currently handles:
- Unit stat recalculation (archetypes, equipment).
- Frame-by-frame movement and path following.
- Combat logic (target acquisition, accuracy, damage).
- Autonomous AI behaviors (VIP AI, Exploration).
- High-level command execution.
- Escort formation logic.

This lack of separation makes the code difficult to maintain, test in isolation, and extend with new unit behaviors or combat mechanics.

## Solution

Decompose the monolithic `UnitManager` into specialized, single-responsibility components. `UnitManager` will transition to a high-level orchestrator that coordinates these components.

### 1. Component Architecture

| Component | Responsibility | Key Interactions |
| :--- | :--- | :--- |
| **`StatsManager`** | Calculates derived stats (Speed, HP, Accuracy) from base archetypes, equipment, and status effects. | Updates `unit.stats`. |
| **`MovementManager`** | Translates path data into unit position updates. Handles door interactions and formation offsets (escorts). | Modifies `unit.pos`, `unit.state`. |
| **`CombatManager`** | Manages target selection, Line of Fire (LOF) checks, and weapon cooldowns. Applies damage to enemies. | Reads `unit.stats`, modifies `enemy.hp`. |
| **`UnitAI`** | Implements autonomous decision-making (VIP behaviors, exploration, retreat logic). | Issues commands or sets `unit.targetPos`. |
| **`CommandExecutor`** | Translates `Command` objects (MOVE, STOP, etc.) into actionable unit states (pathfinding, state resets). | Updates `unit.path`, `unit.activeCommand`. |

### 2. Update Cycle

`UnitManager.update()` will drive the lifecycle of each unit by delegating to sub-components in a deterministic order:

1.  **Preparation**: `StatsManager.updateActiveWeapon()` ensures the correct weapon/stats are active for the current context.
2.  **Decision**:
    - If `unit.aiEnabled`, `UnitAI.process()` determines the next action.
    - `CommandExecutor` processes the next command if the unit is idle.
3.  **Action**:
    - `CombatManager.update()` searches for targets and executes attacks.
    - `MovementManager.update()` updates positions if the unit is in a moving state and not locked in melee.

### 3. Interfaces

To ensure low coupling, sub-managers should ideally interact via well-defined interfaces or by operating directly on the `Unit` and `GameState` objects.

```typescript
interface IUnitComponent {
  update(unit: Unit, state: GameState, dt: number, context: UpdateContext): void;
}
```

## Implementation Plan

1.  **Phase 1: Extraction**: Extract `StatsManager` and `MovementManager` as they have the fewest dependencies.
2.  **Phase 2: Combat & AI**: Extract `CombatManager` and `UnitAI`, refactoring the complex targeting logic.
3.  **Phase 3: Command Integration**: Extract `CommandExecutor` and integrate with the existing `CommandHandler`.
4.  **Phase 4: Orchestration**: Refactor `UnitManager` to inject these components and reduce its `update` method to a series of delegated calls.

## Consequences

- **Pros**:
  - Improved testability: Movement and Combat logic can be tested without a full `UnitManager` setup.
  - Better readability: Smaller files (target < 500 lines) focused on specific domains.
  - Easier extensibility: Adding a new AI profile only requires touching `UnitAI`.
- **Cons**:
  - Slight increase in boilerplate for passing state/context between components.
  - Requires careful management of the update order to avoid frame-delay issues.
