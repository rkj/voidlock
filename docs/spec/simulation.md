# Simulation Architecture & Protocol

## 2) Simulation Architecture

### 2.1 The Game Loop (Web Worker)

The simulation runs at a fixed timestep (e.g., 60Hz or 100ms base tick) but supports **Time Scaling**.

**Initialization:**
Upon receiving the `INIT` command, the engine **MUST** reset internal time scaling and pause states. It must apply the speed configured in the mission settings (default 1.0) and ensure the simulation is NOT paused (unless explicitly configured to start paused). It must NOT inherit transient states (like Active Pause or slow-mo) from a previous session.

**Time Handling:**
The engine `update(scaledDt, realDt)` method accepts two deltas:

1. **`scaledDt` (Game Time)**: Affected by the speed slider (0.1x - 10.0x). Used for:
   - Unit Movement
   - Combat Cooldowns (Fire Rate)
   - Animation states
   - **Director Pacing**: Spawning enemies follows game time, ensuring difficulty scales with game speed.
   - **Timed Actions**: Interactions like "Extracting" or "Collecting" follow game time.
1. **`realDt` (Real Time)**: Constant, unaffected by game speed. (Note: Most systems have been migrated to `scaledDt` to ensure consistent pausing and speed-scaling).

**Update Sequence per Tick:**

1. **Early Exit:** If `scaledDt` is 0 (Paused), return immediately.
1. **Director Update (ScaledDt):** Check spawn timers.
1. **Door Logic:** Update door animations/states.
1. **Visibility:** Re-calc LOS.
1. **Mission:** Update objectives.
1. **Units (ScaledDt):** Move units and update Action timers.
1. **Combat (ScaledDt):** Resolve shots.
1. **State Snapshot:** Emit `WorldState`.

### 2.2 Determinism

- **PRNG:** The engine owns a seeded Pseudo-Random Number Generator. `Math.random()` is forbidden.
- **Replayability:** A run is fully defined by `{ Seed, ContentPack, Config, CommandLog }`.

### 2.3 Door Mechanics

- **Visibility (LOS):** Allowed immediately when a door starts opening (transitioning from `Closed` -> `Open`).
- **Line of Fire (LOF):** Blocked until the door is **Fully Open** (`state === "Open"`). Shooting through a partially opening door is impossible. This applies symmetrically to both Squad and Enemy units.

### 2.4 Speed & Movement Normalization

To ensure consistent simulation across different unit types and time scales, all speed-based calculations use a normalization constant of **30**.

- **Movement**: `Tiles/Second = UnitSpeed / 30`.
  - A unit with `Speed 30` moves at exactly **1.0 tile per second** at 1x game speed.
- **Timed Actions**: `Duration(s) = BaseDuration * (30 / UnitSpeed)`.
- **Firing Rate**: Cooldowns and fire rates are similarly scaled using the factor of 30.

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

1. **Full Visibility:** Map and entities are always visible (Debug/Easy mode).
1. **Classic (Shroud):**
   - Unexplored areas are black (Shroud).
   - Explored areas reveal static map geometry (Walls/Floor).
   - Entities (Enemies) are only visible if currently in active LOS.
1. **Hardcore:**
   - Areas outside current LOS return to "Unknown/Fogged" state (map geometry hidden again).

## 9) Persistence (LocalStorage)

- `lastConfigJson`
- `savedPresets[]`
- `lastSeed`
- Optional: `replays[]` (bounded ring buffer)

## 10) Session Transitions

To prevent state leakage and UI "ghosting", the following sanitization rules apply:

1. **Mission Start (INIT)**:
   - Clear all previous `WorldState` snapshots in the Client.
   - Reset UI components (Command Menu, Soldier Cards, Objective List).
   - Reset Camera position/zoom to default squad focus.
1. **Return to Menu**:
   - Explicitly clear the "Game Over" summary and any active pause overlays.
   - Stop the Replay background process if running.

### World Interaction: Loot & Drops

- **Dropped Items:**
  - When a unit carrying a "Physical Item" (e.g., Artifact) dies, the item is spawned on the map at their death coordinates (`x, y`).
  - **Interaction:** Any unit can perform a `Pickup` action (channeling: 1s) to retrieve the item.

### AI & Commands

See **[Command System & AI Behaviors](commands.md)** for details on `ESCORT_UNIT`, `OVERWATCH_POINT`, and other commands.

## 12) Mission Types & Win Conditions

### Mission Types

1. **Recover Intel:**

   - **Goal:** Locate and secure distributed data terminals.
   - **Setup:** Spawns multiple (default: 3) objectives spread across the map.
   - **Win Condition:** All Intel objectives are `Completed`.
   - **Failure:** Squad wiped before all Intel is secured.
   - **Extraction:** Optional. Mission is a Victory if all Intel is secured, even if the squad is subsequently lost.

1. **Extract Artifact:**

   - **Goal:** Locate the Artifact, pick it up, and Extract with it.
   - **Mechanics:**
     - The Artifact is an item (`artifact_heavy`) added to the soldier's inventory upon objective completion.
     - **Burden:** The carrier suffers stat penalties (e.g., reduced Speed and Aim).
   - **Win Condition:** A unit _carrying the Artifact_ successfully Extracts.
   - **Failure:** Squad wiped, or the Artifact is not extracted.

1. **Destroy Hive:**

   - **Goal:** Eliminate the central Hive structure.
   - **Win Condition:** Hive entity killed.
   - **Extraction:** Optional (Expendable Crew).

1. **Escort VIP:**

   - **Goal:** Escort the VIP to the Extraction zone.
   - **Win Condition:** VIP Extracts.
   - **Failure:** VIP dies.

### Win/Loss Conditions Summary

- **Victory:**
  - **Recover Intel / Destroy Hive:** Objectives Complete (regardless of Squad Status).
  - **Extract Artifact:** Objectives Complete AND >0 Units Extracted.
  - **Escort VIP:** VIP Extracted.
- **Defeat:**
  - Squad Wiped (Active Units = 0) AND Objectives Incomplete.
  - VIP Dead (in Escort missions).
  - Artifact Lost (Squad wiped in Extract Artifact).
