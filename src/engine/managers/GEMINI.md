# src/engine/managers

This directory contains specialized managers that handle specific domains of the game state and logic within the `CoreEngine`.

## Files

- `CommandHandler.ts`: Processes and validates incoming commands from the player or bots.
- `DoorManager.ts`: Manages the state (Open, Closed, Locked, Destroyed) and logic of doors.
- `EnemyManager.ts`: Manages the lifecycle and state updates for all enemy units.
- `MissionManager.ts`: Handles mission-specific setup, objective tracking, and win/loss conditions.
- `UnitManager.ts`: Manages the lifecycle, movement, combat, and AI updates for soldier units.
- `VisibilityManager.ts`: Manages fog-of-war and unit line-of-sight updates.
- `placeholder.ts`: A placeholder file, possibly for future managers or as a template.

## Functionality

- **Modularity**: Each manager is responsible for a well-defined slice of game logic, keeping the `CoreEngine` maintainable.
- **State Updates**: Managers are called during the `CoreEngine` tick loop to update their respective domains.
- **Decoupled Pacing**: Managers like `UnitManager` and `Director` (via `CoreEngine`) support absolute-duration timed actions that remain consistent across different game speed settings.

## Connections

- All managers are instantiated and orchestrated by `src/engine/CoreEngine.ts`.
- They frequently interact with each other (e.g., `UnitManager` uses `VisibilityManager` and `DoorManager`).
