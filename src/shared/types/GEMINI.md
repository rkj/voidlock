# src/shared/types

Modular shared type definitions for Voidlock (ADR 0015).

## Files

- `index.ts`: Barrel file re-exporting all types from this directory.
- `geometry.ts`: Core geometric primitives and definitions (`Vector2`, `Rect`, `WallDefinition`).
- `map.ts`: Map-related structures (`MapDefinition`, `Cell`, `Door`, `Boundary`, `SpawnPoint`, `Grid`, `TileAssembly`).
- `units.ts`: Unit definitions and behaviors (`Unit`, `UnitState`, `Archetype`, `Enemy`, `Command`). Now includes the `AVOID` engagement policy for tactical kiting behaviors (ADR 0023).
- `items.ts`: Item and weapon definitions and libraries (`Item`, `Weapon`, `ItemLibrary`, `WeaponLibrary`).
- `gamestate.ts`: Root state objects and communication protocol (`GameState`, `MissionStats`, `WorkerMessage`, `MainMessage`). Includes `OverlayOption` with support for `renderOnBoard` toggle and `AttackEvent` for tactical feedback.
- `input.ts`: Shared types for the input management system, including `ShortcutInfo`, `InputContext`, and `InputPriority` (ADR 0037). Now includes support for touch event handlers (ADR 0038).

## Guidelines

- **No Circular Imports**: Lower-level modules (e.g., `geometry`) must not import from higher-level modules (e.g., `units`).
- **Strict Typing**: Use interfaces for extensibility and types for unions/primitives. Avoid `any`.
- **Domain Boundaries**: Keep types grouped by their primary domain. If a type is used across many domains, consider moving it to `geometry.ts` or `base.ts` (if created).
