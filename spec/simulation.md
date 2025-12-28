# Simulation Architecture & Protocol

## 2) Simulation Architecture

### 2.1 The Game Loop (Web Worker)

The simulation runs at a fixed timestep (e.g., 60Hz or 100ms base tick) but supports **Time Scaling**.

**Time Decoupling:**
The engine `update(scaledDt, realDt)` method accepts two deltas:
1.  **`scaledDt` (Game Time)**: Affected by the speed slider (0.05x - 5.0x). Used for:
    -   Unit Movement
    -   Combat Cooldowns (Fire Rate)
    -   Animation states
2.  **`realDt` (Real Time)**: Constant, unaffected by game speed. Used for:
    -   **Director Pacing**: Spawning enemies every 10s real-time ensures consistent difficulty pressure regardless of how fast the player plays.
    -   **Timed Actions**: Interactions like "Extracting" or "Collecting" take a fixed real-world duration (e.g., 5s) to prevent "fast-forwarding" through tactical risks.

**Update Sequence per Tick:**

1.  **Director Update (RealDt):** Check spawn timers.
2.  **Door Logic:** Update door animations/states.
3.  **Visibility:** Re-calc LOS.
4.  **Mission:** Update objectives.
5.  **Units (ScaledDt + RealDt):** Move units (Scaled), update Action timers (Real).
6.  **Combat (ScaledDt):** Resolve shots.
7.  **State Snapshot:** Emit `WorldState`.

### 2.2 Determinism

- **PRNG:** The engine owns a seeded Pseudo-Random Number Generator. `Math.random()` is forbidden.
- **Replayability:** A run is fully defined by `{ Seed, ContentPack, Config, CommandLog }`.

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

*   `lastConfigJson`
*   `savedPresets[]`
*   `lastSeed`
*   Optional: `replays[]` (bounded ring buffer)
