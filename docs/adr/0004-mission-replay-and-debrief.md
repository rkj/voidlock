# ADR 0004: Mission Replay & Debrief

**Status:** Proposed

## Context
Xenopurge is a tactical game where missions can be intense. Players benefit from seeing a recap of their performance. We want to implement a "Debrief" screen that appears after mission completion (Victory or Defeat). To make this screen more engaging, we want to play a time-accelerated replay of the mission in the background.

## Proposed Architecture

### 1. Engine Modes
The `CoreEngine` will support distinct execution modes to separate interactive gameplay from automated playback.

```typescript
export enum EngineMode {
  Simulation = "Simulation", // Active gameplay, accepts user commands
  Replay = "Replay",         // Automated playback, ignores user commands
}
```

- **Simulation Mode (Default):** The engine operates as it does currently. User commands are processed, and the mission state progresses naturally.
- **Replay Mode:** The engine executes a recorded log of commands at specific ticks. It ignores external `COMMAND` messages from the `WorkerMessage` protocol.

### 2. Command Logging
To support replays, the engine must record all non-deterministic inputs (user commands).

- **Data Structure:**
  ```typescript
  interface CommandLogEntry {
    tick: number; // Engine time (state.t) when the command was issued
    command: Command;
  }
  ```
- **Storage:** The `CoreEngine` will maintain an internal `commandLog: CommandLogEntry[]`.
- **Extraction:** The `commandLog` will be included in the `GameState` (or available via a query) so the Renderer can persist it if needed.

### 3. Replay Workflow
1. **Recording:** During `Simulation` mode, every command passed to `applyCommand(cmd)` is pushed to the `commandLog` with the current engine time `state.t`.
2. **Trigger:** Upon mission completion (`status` becomes `Won` or `Lost`), the Renderer displays the `Debrief` overlay.
3. **Initialization:** To start a replay, the Renderer sends a new `INIT` message to the Worker.
4. **Reset:** The Worker re-initializes the `CoreEngine` using the *same initial parameters* (seed, map, squad config) but includes the `commandLog` and sets `mode` to `Replay`.
5. **Playback:** In the `update()` loop:
   - If `mode === Replay`, the engine automatically applies commands from the `commandLog` when `state.t` reaches the recorded `tick`.
   - The simulation remains deterministic due to the fixed seed, ensuring the replay perfectly matches the original run.
6. **Speed:** The UI sets a high `timeScale` (e.g., 5.0x) for the replay via `SET_TIME_SCALE`.

### 4. UI/Renderer Interaction
- **Debrief Overlay:** A semi-transparent full-screen overlay (`ScreenDebrief`) is rendered on top of the game canvas.
- **Input Suppression:** While `ScreenDebrief` is active, the `Renderer` ignores all game-world interactions (clicks, hotkeys).
- **Visuals:** The background remains active, rendering the replayed `GameState` snapshots.

### 5. Protocol Updates
- `WorkerMessage.INIT` payload will be extended to include an optional `commandLog` and `mode`.
- `GameState` will include `mode` and optionally the current `commandLog`.
- Standardization of `status`: The project currently has a mix of `"Won"/"Lost"` and `"Victory"/"Defeat"`. We will standardize on `"Won"/"Lost"` for `GameState.status` to match the `MissionManager` implementation.

## Consequences

### Pros
- **Deterministic Replay:** Leverages the existing deterministic engine design.
- **Low Overhead:** Only commands are recorded, minimizing memory and storage requirements.
- **Engaging UX:** Provides a polished "After Action Report" experience.

### Cons
- **Non-deterministic Risks:** Any accidental use of `Math.random()` or reliance on real-time clock instead of `scaledDt` will cause replay desync.
- **Storage:** Very long missions with thousands of commands might result in large logs, though this is unlikely given the game's scope.
