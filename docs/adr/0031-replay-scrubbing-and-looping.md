# ADR 0031: Deterministic Replay Scrubbing and Looping

## Status

Proposed

## Context

The post-mission Debrief Screen (ADR 0030) provides a replay of the mission. Currently, this replay is linear and only supports playback speed adjustments and pausing. Users need the ability to "scrub" (seek) to specific points in the mission timeline to review key moments. Additionally, the replay should optionally loop or provide an easy way to restart.

As the game simulation is deterministic and tick-based, seeking to a specific time requires the engine to be at the exact state corresponding to that time.

## Decision

We will implement deterministic scrubbing by leveraging the existing `targetTick` and `commandLog` infrastructure in the `CoreEngine`.

### 1. Engine State Seeking (Scrubbing)

- **Mechanism**: Seeking to a `targetTick` will be implemented by re-initializing the `CoreEngine` with the original mission parameters (seed, map, squad) and the full `commandLog`. The engine will then perform a fast-forward (catch-up) to the `targetTick` before resuming normal updates.
- **Worker Protocol**: The existing `INIT` message already supports `commandLog` and `targetTick`. We will ensure `CoreEngine` performs catch-up for `EngineMode.Replay` just as it does for `EngineMode.Simulation`.
- **GameClient API**: A new `seek(tick: number)` method will be added to `GameClient` which triggers the re-initialization process.
- **Optimization**: To avoid visible flickering, the `GameClient` should ideally handle the transition smoothly. For now, the re-initialization is fast enough that it appears near-instant for typical mission lengths.

### 2. Replay Looping

- **Logic**: When the replay reaching the end of the mission (detected by `state.t >= totalTime`), the `ReplayController` can optionally trigger a `seek(0)`.
- **UI**: The playback controls will be updated to include a loop toggle (optional) or simply support manual scrubbing back to the start.

### 3. UI Scrubber

- **Implementation**: The existing progress bar in the `DebriefScreen` will be replaced with an interactive range input (`<input type="range">`).
- **Interaction**:
  - While scrubbing (dragging the slider), the replay is paused.
  - On input change, the `ReplayController` is notified of the new target time.
  - The `ReplayController` calculates the target tick and calls `gameClient.seek(tick)`.

## Consequences

- **Performance**: Re-initializing the engine on every scrub input might be expensive for very long missions or high-frequency input. If performance becomes an issue, we will implement state snapshots (checkpoints) every N seconds.
- **Determinism**: The replay remains perfectly deterministic as it always starts from the same initial state and applies the same commands.
- **Simplicity**: Leveraging existing `INIT` and `targetTick` logic avoids introducing complex state management in the worker.
