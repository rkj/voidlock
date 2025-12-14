### Part 1: Game Design Document (GDD)

# GDD: Xenopurge (Web Prototype)
**Version:** 1.2
**Core Concept:** Single-player, Real-Time with Pause (RTwP) tactical squad combat in a claustrophobic spaceship environment.

---

## 1) Scope & Design Pillars

### 1.1 In Scope
* **Engine:** Deterministic, tick-based simulation running in a Web Worker.
* **Visuals:** 2D Top-down, Grid-based, "Shared Wall" rendering via HTML5 Canvas.
* **Loop:** Configure Squad -> Load Map -> Real-Time Tactical Combat -> Extract or Die.
* **Modding:** "Content Packs" (JSON) strictly define stats, maps, and logic parameters.
* **AI Support:** First-class support for bot players via a JSON observation/command protocol.

### 1.2 Out of Scope
* Multiplayer networking (Local only).
* Meta-progression (XP, Campaign map, Loot inventory).
* Complex Frameworks (React/Vue) — strictly Vanilla TS + Vite.

---

## 2) Simulation Architecture

### 2.1 The Game Loop (Web Worker)
The simulation runs at a fixed timestep (`tickMs`, default 100ms).
**Update Sequence per Tick:**
1.  **AI Think:** Update Bot/Enemy intent based on new state.
2.  **Command Processing:** Validate and apply player/agent commands from the queue (FIFO).
3.  **Action Resolution:** Tick down action cooldowns (movement, shooting).
4.  **Movement Integration:** Update positions if move cooldown complete.
5.  **Combat Resolution:** Resolve shots fired, calculate hits/damage, apply death.
6.  **Director:** Check spawn timers (default 45s cycle).
7.  **State Snapshot:** Emit `WorldState` to the Main Thread (Renderer).

### 2.2 Determinism
* **PRNG:** The engine owns a seeded Pseudo-Random Number Generator. `Math.random()` is forbidden.
* **Replayability:** A run is fully defined by `{ Seed, ContentPack, Config, CommandLog }`.

---

## 3) World Model & Data Structures

### 3.1 The Grid (Shared Walls)
The map is a grid of `Cells`. Walls are edges *between* cells, shared by neighbors (like a house floorplan).
* **Coordinate System:** `x` (Column), `y` (Row). Top-left is `0,0`.
* **Adjacency:** Orthogonal only (North, South, East, West). **No diagonal movement.**

**Cell Data Model (Logical):**
Ideally implemented so cells "own" specific edges (e.g., North and West) to prevent data duplication/desync, or via a separate Edge Map.
```typescript
interface Cell {
  x: number;
  y: number;
  type: 'Floor' | 'Void';
  // Logical accessors (derived from shared edge data)
  walls: { n: boolean; e: boolean; s: boolean; w: boolean; };
  doorId?: string;
  spawnPointId?: string;
  extraction?: boolean;
}
````

### 3.2 Units (Soldiers & Enemies)

**Soldier Stats:**

  * `hp`: Current Health.
  * `speed`: Movement cooldown (seconds per tile).
  * `sightRange`: Radius of vision in tiles.
  * `weapon`: Reference to Weapon Definition.
  * `engagementPolicy`:
      * `ENGAGE`: (Default) If an enemy is in LOS, stop moving and shoot.
      * `IGNORE`: Ignore enemies, continue moving/performing actions (used for fleeing/rushing).
  * **Action Queue:** Units support a queue of commands (e.g., "Move to A", then "Move to B", then "Interact").

**Weapon Definition:**

  * **No Ammo:** Weapons have infinite ammo.
  * **Fire Rate:** Defined as a cooldown between shots.
  * **Stats:** `damage`, `range`, `fireRateMs`.

**Enemy AI Behavior:**

  * **No Noise:** Enemies do not react to sound.
  * **Exploration:** Enemies wander randomly but use a heuristic to prioritize cells `visitedTimestamp` is oldest or `null`.
  * **Aggro:** On LOS of a Soldier -\> Switch to Attack state and pathfind directly to target.

-----

## 4\) Gameplay Mechanics

### 4.1 Fog of War (FOW) Configuration

The visibility rules depend on the Mission/Map config:

1.  **Full Visibility:** Map and entities are always visible (Debug/Easy mode).
2.  **Classic (Shroud):**
      * Unexplored areas are black (Shroud).
      * Explored areas reveal static map geometry (Walls/Floor).
      * Entities (Enemies) are only visible if currently in active LOS.
3.  **Hardcore:**
      * Areas outside current LOS return to "Unknown/Fogged" state (map geometry hidden again).

### 4.2 The Director (Spawning)

Spawns occur on a fixed timer (default 45s).
**Algorithm:**

1.  **Base Amount:** Map difficulty defines `X` base enemies.
2.  **Scaling:** `+1` enemy added to the pool per wave.
3.  **Distribution:** Enemies are distributed randomly among valid `SpawnPoints`.
4.  **Upgrade Logic:** Probabilistic replacement of weak enemies with strong ones (e.g., "2 Small enemies replaced by 1 Large enemy").

### 4.3 Commands

| Command | Payload | Description |
| :--- | :--- | :--- |
| `MOVE_TO` | `unitIds`, `target` | Pathfinds and moves. Can be queued. |
| `ATTACK_TARGET` | `unitId`, `targetId` | Forces fire on specific enemy. |
| `SET_ENGAGEMENT` | `unitIds`, `mode` | Toggle `ENGAGE` (Stop & Shoot) or `IGNORE` (Run). |
| `STOP` | `unitIds` | Clears command queue and halts. |

-----

## 5\) Protocol: Engine ↔ Client

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

````

---

