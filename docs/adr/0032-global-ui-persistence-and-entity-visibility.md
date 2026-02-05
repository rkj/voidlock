# ADR 0032: Global UI Persistence and Entity Visibility

## Status

Accepted

## Context

Several UI bugs have been identified where the Settings screen is inaccessible or obscured by mode-specific shells (e.g., `CampaignShell`). Additionally, static mission entities like Enemy Spawn Points (Vents) are often invisible to the player because they are omitted from state observations after the initial map load, despite being critical for tactical planning.

## Decision

### 1. Global UI Containers

To ensure that global UI components (Settings, Modal System) are always accessible and correctly layered:

- They MUST be placed in top-level containers in the root `index.html`.
- They MUST exist outside of any mode-specific shell or layout container.
- The `ScreenManager` and `GameApp` must orchestrate their visibility such that they appear "on top" of any active game state without layout shifts in the background content.

### 2. Authoritative Entity Visibility

To ensure consistent rendering of tactical mission entities:

- The game engine MUST include the definitions of all static mission entities (Enemy Spawn Points, Extraction Zones, Objectives) in the authoritative state observation sent to the renderer in every tick.
- This ensures that even when the renderer "culls" the static map data to save bandwidth, it maintains a fresh and authoritative record of mission-critical locations.

## Consequences

- **Positive**: Resolves "Black Screen" settings bug. Ensures players can always see where enemies might emerge.
- **Negative**: Minor increase in JSON payload size per tick (negligible for the current number of entities).
- **Maintenance**: Requires updating `CoreEngine.getState()` and `MapEntityLayer.draw()`.
