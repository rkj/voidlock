# ADR 0015: Modular Shared Types

## Context

The `src/shared/types.ts` file has grown to approximately 1000 lines. It currently houses all type definitions for the project, including geometry primitives (`Vector2`), map structures (`Cell`, `Door`), unit states, item libraries, and the global `GameState`.

This monolithic structure presents several issues:

1. **Cognitive Load:** Developers must search through unrelated types to find specific definitions.
1. **Coupling:** It encourages implicit coupling between disparate domains (e.g., Map generation types and Combat types).
1. **Merge Conflicts:** Frequent changes to this single file cause unnecessary merge conflicts.

## Decision

We will refactor `src/shared/types.ts` into a directory-based module structure at `src/shared/types/`.

### Structure

- `index.ts`: A "barrel" file that re-exports all types to maintain backward compatibility with existing imports initially.
- `geometry.ts`: core primitives (`Vector2`, `Rect`, `WallDefinition`).
- `map.ts`: Map-related structures (`MapDefinition`, `Cell`, `Door`, `Boundary`, `SpawnPoint`).
- `units.ts`: Unit definitions (`Unit`, `UnitState`, `Archetype`, `Stats`).
- `items.ts`: Item and Weapon definitions (`Item`, `Weapon`, `Inventory`).
- `gamestate.ts`: The root state objects (`GameState`, `Command`, `MissionStats`).

### Guidelines

- **No Circular Imports:** Lower-level modules (e.g., `geometry`) must not import from higher-level modules (e.g., `units`).
- **Strict Typing:** Avoid `any`. Use interfaces for extensibility and types for unions/primitives.

## Consequences

- **Positive:** significantly improved readability and navigability. Clearer domain boundaries. Reduced merge conflicts.
- **Negative:** Requires updating imports if bypassing the barrel file (though using the barrel file is recommended for public API).
