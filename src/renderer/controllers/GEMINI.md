# src/renderer/controllers

This directory contains decoupled logic managers for the tactical UI, following ADR 0017.

## Components

- `MenuStateMachine.ts`: Manages the stack of menu states (`ACTION_SELECT`, `TARGET_SELECT`, etc.) and handles transitions between them.
- `SelectionManager.ts`: Tracks the current selection context, including pending actions, targets, modes, and shift-key state.
- `RoomDiscoveryManager.ts`: Encapsulates the logic for tracking discovered rooms and maintaining a stable discovery order for menu keys.
- `TargetOverlayGenerator.ts`: Handles the generation of tactical map overlays for target selection (e.g., Rooms, Items, Units, Intersections).
- `ReplayController.ts`: Manages the lifecycle and playback logic for mission replays on the Debrief Screen, including integration with the `GameClient` and rendering to a dedicated canvas.
- `CommandBuilder.ts`: A static utility for constructing `Command` objects from the current selection context.

## Architecture

These managers are used as delegates by the `MenuController`, which acts as a facade for the tactical UI. This decoupling allows for easier unit testing of UI logic without requiring a full DOM or Canvas environment.
