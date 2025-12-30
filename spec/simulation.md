# Simulation Architecture & Protocol

## 2) Simulation Architecture

### 2.1 The Game Loop (Web Worker)

The simulation runs at a fixed timestep (e.g., 60Hz or 100ms base tick) but supports **Time Scaling**.

**Time Handling:**
The engine `update(scaledDt, realDt)` method accepts two deltas:

1.  **`scaledDt` (Game Time)**: Affected by the speed slider (0.05x - 5.0x). Used for:
    - Unit Movement
    - Combat Cooldowns (Fire Rate)
    - Animation states
    - **Director Pacing**: Spawning enemies follows game time, ensuring difficulty scales with game speed.
    - **Timed Actions**: Interactions like "Extracting" or "Collecting" follow game time.
2.  **`realDt` (Real Time)**: Constant, unaffected by game speed. (Note: Most systems have been migrated to `scaledDt` to ensure consistent pausing and speed-scaling).

**Update Sequence per Tick:**

1.  **Early Exit:** If `scaledDt` is 0 (Paused), return immediately.
2.  **Director Update (ScaledDt):** Check spawn timers.
3.  **Door Logic:** Update door animations/states.
4.  **Visibility:** Re-calc LOS.
5.  **Mission:** Update objectives.
6.  **Units (ScaledDt):** Move units and update Action timers.
7.  **Combat (ScaledDt):** Resolve shots.
8.  **State Snapshot:** Emit `WorldState`.

### 2.2 Determinism

- **PRNG:** The engine owns a seeded Pseudo-Random Number Generator. `Math.random()` is forbidden.
- **Replayability:** A run is fully defined by `{ Seed, ContentPack, Config, CommandLog }`.

### 2.3 Door Mechanics

- **Visibility (LOS):** Allowed immediately when a door starts opening (transitioning from `Closed` -> `Open`).
- **Line of Fire (LOF):** Blocked until the door is **Fully Open** (`state === "Open"`). Shooting through a partially opening door is impossible. This applies symmetrically to both Squad and Enemy units.

## 5) Protocol: Engine ↔ Client

### 5.1 Observation Packet

Sent from Engine to UI/Bot every tick.

```json
{
  "tick": 1054,
  "status": "RUNNING",
  "visible": {
    // Only entities currently in LOS of the squad
    "soldiers": [{ "id": "s1", "pos": {"x": 10, "y": 4}, "hp": 100 }],
    "enemies": [{ "id": "e1", "pos": {"x": 12, "y": 4}, "hp": 30 }],
    "doors": [{ "id": "d1", "state": "Closed" }]
  },
  "fow": {
    // Discovery state based on FOW Config
    "discoveredCells": [[10,4], [10,5]...]
  }
}
```

## 4.2 Fog of War (FOW) Configuration

The visibility rules depend on the Mission/Map config:

1.  **Full Visibility:** Map and entities are always visible (Debug/Easy mode).
2.  **Classic (Shroud):**
    - Unexplored areas are black (Shroud).
    - Explored areas reveal static map geometry (Walls/Floor).
    - Entities (Enemies) are only visible if currently in active LOS.
3.  **Hardcore:**
    - Areas outside current LOS return to "Unknown/Fogged" state (map geometry hidden again).

## 9) Persistence (LocalStorage)

- `lastConfigJson`
- `savedPresets[]`
- `lastSeed`
- Optional: `replays[]` (bounded ring buffer)
