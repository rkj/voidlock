# ADR 0040: Debug Snapshots in Replay

**Status:** Accepted

## Context

To debug AI behaviors, pathfinding logic, and complex game state transitions, developers often need more granular data than what is visible in the standard visual representation. We need a mechanism to capture "snapshots" of internal engine state (e.g., behavior tree decisions, specific variable values at a point in time) and make them available for inspection.

Crucially, this data must be preserved in the **Mission Replay** so that developers can analyze a session post-mortem without needing to attach a debugger to the live game loop (which is running in a Web Worker).

## Decision

### 1. Data Structure

We will extend the `GameState` and `ReplayData` interfaces to include an optional `snapshots` array.

```typescript
// src/shared/types/gamestate.ts
export interface GameState {
  // ... existing fields
  snapshots?: DebugSnapshot[];
}

export interface ReplayData {
  // ... existing fields
  snapshots?: DebugSnapshot[];
}
```

A `DebugSnapshot` can contain arbitrary JSON-serializable data relevant to the debugging context (e.g., `unitId`, `behaviorState`, `pathScores`).

### 2. Engine Logic

- **Configuration:** A new setting `debugSnapshots` (boolean) is added to `GameSettings`.
- **Capture:** When enabled, the `CoreEngine` (or subsystems) will push data to `this.state.snapshots`.
- **Persistence:** These snapshots are part of the `GameState` and are maintained in memory during the session.

### 3. Worker-to-Main Communication

Since the `snapshots` array can grow large, sending it with every tick (60Hz) is inefficient. We implement a **Delta-like Optimization** in the Web Worker loop:

1. The Worker tracks the `lastSnapshotCount`.
2. When preparing the `STATE_UPDATE` message:
   - If `state.snapshots.length === lastSnapshotCount`, the `snapshots` field is removed (`deleted`) from the payload before sending.
   - If the length has changed (i.e., new snapshots were added), the **entire** array is sent.
3. The `GameClient` (Main Thread) checks for the presence of `msg.payload.snapshots`.
   - If present, it updates its local cache: `this.snapshots = msg.payload.snapshots`.
   - If absent, it retains the previous cache.

### 4. Replay Export

When `GameClient.getReplayData()` is called (e.g., by the "Export Recording" button on the Debrief screen), it includes the full cached `this.snapshots` array in the export. This ensures that the downloaded JSON file contains all debugging data captured during the session.

## Consequences

### Pros

- **Post-Mortem Debugging:** Developers can analyze complex AI behavior by replaying the mission and inspecting the attached snapshots.
- **Bandwidth Efficiency:** The optimization ensures that the large snapshot array is only transferred across the Worker boundary when necessary (sparse updates).
- **Zero Overhead when Disabled:** When `debugSnapshots` is false, no data is collected or sent.

### Cons

- **Memory Usage:** In extremely long sessions with frequent snapshots, the `snapshots` array could grow large in memory. Mitigation: Developers should use this feature selectively or implement a circular buffer if memory becomes an issue (future work).
