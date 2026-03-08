# src/engine/managers/commands

Command execution infrastructure. Implements the command pattern for all game actions (ADR 0007).

## Files

- `GlobalCommandRegistry.ts`: Registry for global commands (not unit-specific).
- `UnitCommandRegistry.ts`: Registry for unit-targeted commands.
- `IGlobalCommandHandler.ts`: Interface for global command handlers.
- `IUnitCommandHandler.ts`: Interface for unit command handlers.
- `handlers/`: Individual command handler implementations.
