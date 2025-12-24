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

  * **Archetypes:**
      *   **Xeno-Mite (Easy):** Fast, weak, melee swarmer.
      *   **Warrior-Drone (Medium):** Balanced stats, standard melee unit.
      *   **Praetorian-Guard (Hard):** Slow, heavily armored, high melee damage.
      *   **Spitter-Acid (Ranged):** Ranged attack. Logic: Kites players (moves to max range), flees if engaged in melee.
  * **Melee Only:** For the current prototype, all enemies use melee-only attacks. (Obsolete - Spitter added)
  * **Autonomous Roaming:** Enemies roam the ship autonomously when no soldiers are detected, prioritizing undiscovered or less-visited floor cells.
  * **Aggro:** On LOS of a Soldier -> Switch to Attack state and pathfind directly to the closest soldier to engage. Spitters maintain distance.
  * **Modular Design:** The AI should be implemented using an extensible interface/strategy pattern to support future enemy types (e.g., ranged units, different roaming strategies).

**Visuals:**
  * **Doors:** Render as 50% width/height of the cell, connecting visually to adjacent walls to prevent gaps.

**Simulation & Balance:**
  * **Game Speed:** Default tick rate slowed by 3x. Debug config to adjust tick rate in real-time.
  * **Balance Goal:** A 4-soldier team with default AI should win ~50% of the time on an 8x8 map. >50% of wins should incur at least one casualty.

-----

## 4) Gameplay Mechanics

### 4.1 Soldier logic profile

The automated soldier AI follows a multi-tier logic profile when not under direct manual control:

1.  **Threat Evaluation:**
    *   Units continuously scan for visible enemies within their `sightRange`.
    *   Threat level is calculated based on distance, enemy type, and unit's current HP.
    *   Enemies attacking the unit or its squadmates receive highest priority.

2.  **Engagement (Default Policy: `ENGAGE`):**
    *   If a threat is detected and `engagementPolicy` is `ENGAGE`:
        *   The unit will prioritize attacking the highest-priority target within `attackRange`.
        *   If no targets are in `attackRange` but threats are visible, the unit will move toward the closest threat until in range.
        *   Units will "Stop & Shoot" — pausing movement to resolve combat unless the command was explicitly queued with `IGNORE`.

3.  **Self-preservation:**
    *   **Retreat:** If HP falls below 25%, the unit's logic switches to `IGNORE` engagement and prioritizes moving away from the closest threat toward a discovered "safe" cell (no visible enemies).
    *   **Group Up:** If a unit is isolated (no allies within 5 tiles) and threats are present, it prioritizes moving toward the closest ally.

4.  **Autonomous Exploration:**
    *   If no threats are present and no manual commands are queued, units prioritize exploring the closest undiscovered floor cells.
    *   Once the map is fully discovered and all objectives are complete, units automatically pathfind to the extraction point.

### 4.2 Fog of War (FOW) Configuration

The visibility rules depend on the Mission/Map config:

1.  **Full Visibility:** Map and entities are always visible (Debug/Easy mode).
2.  **Classic (Shroud):**
      * Unexplored areas are black (Shroud).
      * Explored areas reveal static map geometry (Walls/Floor).
      * Entities (Enemies) are only visible if currently in active LOS.
3.  **Hardcore:**
      * Areas outside current LOS return to "Unknown/Fogged" state (map geometry hidden again).

### 4.3 The Director (Spawning)

Spawns occur on a fixed timer (default 45s).
**Algorithm:**

1.  **Base Amount:** Map difficulty defines `X` base enemies.
2.  **Scaling:** `+1` enemy added to the pool per wave.
3.  **Distribution:** Enemies are distributed randomly among valid `SpawnPoints`.
4.  **Upgrade Logic:** Probabilistic replacement of weak enemies with strong ones (e.g., "2 Small enemies replaced by 1 Large enemy").

### 4.4 Commands

| Command | Payload | Description |
| :--- | :--- | :--- |
| `MOVE_TO` | `unitIds`, `target` | Pathfinds and moves. Can be queued. |
| `ATTACK_TARGET` | `unitId`, `targetId` | Forces fire on specific enemy. |
| `SET_ENGAGEMENT` | `unitIds`, `mode` | Toggle `ENGAGE` (Stop & Shoot) or `IGNORE` (Run). |
| `STOP` | `unitIds` | Clears command queue and halts. |

-----

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
````

---

## 7) Pluggable balancing and generation interfaces

### 7.1 Content pack structure

* `pack.json` (data)
* Optional `pack.js` exporting generator/director implementations

Example:

```json
{
  "id": "default-pack",
  "version": "0.1.0",
  "rules": {
    "tickMs": 100,
    "fogOfWar": true,
    "lineOfSight": {"type":"gridRaycast","maxRange":10}
  },
  "soldierArchetypes": {...},
  "enemyArchetypes": {...},
  "commands": {...}
}
```

### 7.2 Required interfaces



**MapGenerator**



*   `generate(prng, config) -> MapDefinition`

    *   `load(mapData: MapDefinition) -> MapDefinition` (New: to load predefined maps)

    *   `validate(map) -> issues[]`

    *   **Map Generation Strategy Selection**: The `MapGenerator` (or its client) must support selecting different generation strategies (e.g., `procedural-maze`, `static-predefined`, `custom-scripted`).

    *   **Connectivity Guarantee (No "Open Walls to Nowhere"):**
        *   **Concept:** "Walls" are edges between cells, never full tiles.
        *   **Implementation Rule:** The generator must post-process the map using a flood-fill algorithm starting from the spawn point(s).
            *   Any cell reached by flood-fill (passing only through open walls/doors) becomes a valid `Floor` cell.
            *   Any cell *not* reached by this flood-fill must be converted to `Void` (Outer Space).
        *   **Goal:** This prevents the rendering artifact where a Floor cell has an open edge (no wall) leading into a Void cell, effectively creating an "open wall to nowhere".

**TreeShipGenerator (Sector Layout) Specifics:**
The `TreeShipGenerator` produces maps with a structured layout:
*   **Map Size:** Maps must not exceed 16x16 tiles.
*   **Fill Rate:** Can be sparse (<90% coverage) to create a claustrophobic, wall-heavy feel.
*   **Structure:**
    *   **Corridors (Depth 0):** A few long corridors traversing the map.
        *   **No Internal Doors:** Corridors should be open segments. Do not place doors *inside* the corridor length (only at ends or room entrances).
        *   **Dimensions:** Strictly 1 tile wide.
    *   **Rooms (Depth 1+):** Rooms connect to corridors or other rooms.
        *   **Room Size:** Max 2x2.
        *   **No Nested Rooms:** A 2x2 room must be fully open internally (no internal walls or doors blocking the 2x2 space). 1x1 rooms cannot be "inside" or part of a 2x2 block that isn't fully open.
    *   **Depth Hierarchy & Acyclicity:** (Same as DenseShipGenerator)
        *   Rooms form a strict tree structure from the corridors.
        *   No cycles (acyclic graph).
        *   No back-links (Depth N connects only to N-1).

**DenseShipGenerator Specifics:**
A high-density generator designed for exploration depth.
*   **Fill Rate:** Must achieve >90% floor coverage (almost all cells accessible).
*   **Structure:** Same rules as TreeShipGenerator (Corridors, Rooms, Depth Hierarchy, Acyclicity, No Nested Rooms), but maximizing density.
*   **Difficulty Scaling:**
    *   Easy/Small Maps: Max depth 1.
    *   Hard/Large Maps: Max depth 3-4.

**DenseShipGenerator Specifics:**
A high-density generator designed for exploration depth.
*   **Fill Rate:** Must achieve >90% floor coverage (almost all cells accessible).
*   **Structure - Frame & Rooms:**
    *   **Corridor Frame:** The map skeleton is built from 1-tile wide corridors (1xN or Nx1).
        *   **Length:** Each corridor segment must be at least 50% of the map's dimension in that direction.
        *   **Spacing:** Parallel corridors must never be adjacent (no 2-tile wide corridors). There must be at least 1 tile of space between them (which will be filled by rooms).
        *   **Connectivity:** Corridors can intersect (forming H, T, or + shapes) but must form a single connected component.
    *   **Rooms:** Rooms are attached to the corridor frame.
        *   **Strict Shapes:** Rooms must be rectangular and strictly one of these dimensions: 1x1, 1x2, 2x1, or 2x2.
        *   **No Irregular Shapes:** No L-shapes, T-shapes, or non-rectangular rooms allowed.
    *   **Connectivity:** Rooms connect to the corridor frame or to other rooms, maintaining the overall tree-like flow from the frame.
*   **Difficulty Scaling:**
    *   Easy/Small Maps: Max depth 1.
    *   Hard/Large Maps: Max depth 3-4.


**Director**
* `update(prng, state) -> SpawnPlan[]`

**CombatResolver**

* `resolve(state, dt) -> { damageEvents[], statusEvents[] }`

**Pathfinder**

* `findPath(map, from, to) -> cell[]`

All should be swappable. Default implementations ship with the prototype; content packs can replace any subset.

### 7.3 ASCII Map Representation

To facilitate easy creation and debugging of maps, especially for hardcoded or test scenarios, the system should support conversion between `MapDefinition` and a simplified ASCII string format that accurately reflects the "walls between cells" model.

*   **Format**: The ASCII representation will use an expanded grid where each character position either represents a cell's content, a wall segment, or a wall corner. For a map of `width` W and `height` H, the ASCII grid will be `(2W+1)` columns wide and `(2H+1)` rows tall.

    *   **Cell Content Characters (at `(2x+1, 2y+1)` positions):**
        *   `' '` (space): Floor cell (passable, default interior of the ship).
        *   `'#'`: Wall cell (impassable, "void" or "outside" the ship).
        *   `'S'`: Floor cell with a Spawn Point
        *   `'E'`: Floor cell with an Extraction Point
        *   `'O'`: Floor cell with an Objective
        *   *Priority*: For Floor cells: `S` > `E` > `O` > ` `. If Cell is `Wall`, then `#` overrides all other content.

    *   **Wall/Passage Characters:**
        *   **Horizontal Wall/Passage (at `(2x+1, 2y)` positions):**
            *   `'-'`: Horizontal wall segment
            *   `' '` (space): Horizontal open passage (no wall)
        *   **Vertical Wall/Passage (at `(2x, 2y+1)` positions):**
            *   `'|'`: Vertical wall segment
            *   `' '` (space): Vertical open passage (no wall)
        *   **Door (replacing a wall segment):**
            *   `'='`: Horizontal Door (replaces `'-'`)
            *   `'I'`: Vertical Door (replaces `'|'`)
        *   **Corner Characters (at `(2x, 2y)` positions):**
            *   `'+'`: Default corner (intersection of walls)
            *   `' '` (space): Corner with no adjacent walls (or just for visual spacing if open passages meet)

*   **Conversion**:
    *   `toAscii(map: MapDefinition) -> string`: Convert a `MapDefinition` object into its ASCII string representation.
    *   `fromAscii(asciiMap: string) -> MapDefinition`: Parse an ASCII string representation back into a `MapDefinition` object.
    *   *Note*: The `fromAscii` conversion will need sensible defaults for attributes not explicitly representable in ASCII (e.g., door HP, objective kind). It will also need to infer wall `true`/`false` based on the presence of `'-'`, `'|'`, `'='`, `'I'` characters.

**Example 2x2 Map:**

Given the following `MapDefinition`:
```typescript
{
  width: 2,
  height: 2,
  cells: [
    { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: false, w: true } },
    { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: false, w: false } },
    { x: 0, y: 1, type: CellType.Floor, walls: { n: false, e: false, s: true, w: true } },
    { x: 1, y: 1, type: CellType.Floor, walls: { n: false, e: true, s: true, w: false } },
  ],
  doors: [
    {
      id: 'door1',
      segment: [{x:0, y:0}, {x:0, y:1}],
      orientation: 'Horizontal',
      state: 'Closed',
      hp: 10, maxHp: 10, openDuration: 1
    }
  ],
  spawnPoints: [{ id: 'sp1', pos: { x: 0, y: 0 }, radius: 1 }],
  extraction: { x: 1, y: 1 },
  objectives: [{ id: 'obj1', kind: 'Recover', targetCell: { x: 0, y: 1 } }],
}
```
The `toAscii` representation should be:
```
+-+-+
|S  |
+=  +
|O E|
+-+-+
```


---

## 8) UI/UX requirements (web)

### 8.1 Screen Flow Architecture

The application is divided into distinct screens to reduce UI clutter and improve flow.

1.  **Main Menu (Welcome Screen)**
    *   **Title**: "Xenopurge"
    *   **Credits**: Author/Version info.
    *   **Navigation**:
        *   "Campaign" -> Go to Campaign Screen.
        *   "Custom Mission" -> Go to Mission Setup Screen.
        *   "Load Replay" -> Import replay JSON.
    *   *Note*: Pressing `ESC` from other screens (except Mission) returns here (or to previous screen).

2.  **Campaign Screen** (Placeholder for M9+)
    *   List of available missions (currently empty or "Coming Soon").
    *   "Back" button -> Main Menu.

3.  **Mission Setup Screen** (formerly Config Screen)
    *   **Map Configuration**:
        *   Generator Type (Procedural, TreeShip, Static).
        *   Seed Input / Randomize.
        *   Map Size (Width/Height).
        *   Static Map Import (Text/File/ASCII).
    *   **Game Options**:
        *   Fog of War, Debug Overlay, Agent Control toggles.
    *   **Squad Configuration**:
        *   Select archetypes/count.
    *   **Actions**:
        *   "Launch Mission" -> Starts Engine, switches to Mission Screen.
        *   "Back" -> Main Menu.

4.  **Mission Screen** (Active Gameplay)
    *   **Main View**: Canvas/WebGL rendering of the game world.
    *   **Top Left Overlay**: Display current Map Seed (e.g., "Seed: 12345").
    *   **Left Panel**: Squad List (Health, Status) + Quick Commands.
    *   **Right Panel**:
        *   **Objectives List**: Current status of mission objectives.
        *   **Extraction Status**: Location/Progress.
        *   **Threat Meter**: Visual indicator of Director intensity.
    *   **Bottom Panel**: Timeline/Event Log.
    *   **Input**:
        *   `ESC`: Opens **Pause Overlay** (Resume / Abort Mission).

### 8.3 Control Scheme & Keyboard Navigation
The game must be fully playable via keyboard using a hierarchical command menu.

*   **Menu Structure:**
    *   **Level 1 (Action Category):**
        *   `1`: Move
        *   `2`: Collect Items (Objectives)
        *   `3`: Extract
        *   `4`: Use Item (Grenade, Medkit - *Future*)
    *   **Level 2 (Target Selection):**
        *   Context-dependent submenus (e.g., "Select Target Cell", "Select Item").
        *   **Map Overlay:** When a command requires a spatial target, the map should overlay numbers (1-N) on valid targets (cells, enemies, items) for quick selection.
    *   **Level 3 (Unit Selection):**
        *   `1-N`: Select specific soldier to perform the action.
        *   `N+1`: "All" (if applicable).

### 8.4 UI Layout Reorganization
The UI must be optimized for visibility and information density, utilizing the full width of the screen.

*   **Top Bar (Header):** Fixed height (e.g., 40px). Displays Game Time, Status (Playing/Won/Lost), Seed, **Version** (SemVer), and global alerts.
*   **Soldier Bar (Sub-header):** Full-width strip below the top bar. Displays all soldiers in a horizontal layout.
    *   **Layout:** Items must fit within the container **without scrolling** (no overflow). Use flexible sizing to fill available width.
    *   **Soldier Card:** Wider fixed or flexible width to prevent text wrapping. Visual stability is key—content updates (e.g., status text changes) must NOT cause layout jitter (box resizing).
    *   **Controls:** "Stop" button must be functional and immediately halt the unit.
*   **Main Simulation Area:** Flex container below the Soldier Bar.
    *   **Game Canvas (Left/Center):** Takes up the majority of the screen. Must be centered within its container.
    *   **Command Panel (Right):** Fixed width (e.g., 300px). Contains the hierarchical keyboard command menu, objective list, and threat meter.
    *   **Game Over Summary:** Upon Win/Loss, a summary panel/popup must appear (or replace the Right Panel) showing:
        *   Result (Mission Accomplished / Squad Wiped).
        *   Statistics: Time Elapsed, Aliens Killed, Casualties.
        *   Action: "Back to Menu" button.

### 8.5 Mission Configuration
*   **Spawn Points:** The number of initial spawn points (vents/entry points for enemies) must be configurable in the Mission Setup screen (Range: 1 to 10) and **strictly adhered to** by the generator.
*   **Strict Placement Rules:**
    *   **Spawn Points:** Must ONLY be placed in rooms, never in corridors.
    *   **Objectives & Hive:** Must ONLY be placed in rooms, never in corridors.
    *   **Corridors:** Must remain clear of all static mission entities to maintain the "frame" integrity.

### 8.2 Debug affordances (non-negotiable for balancing)

*   Toggle “show all” (disable fog) for quick iteration.
*   Heatmaps/overlays:

    *   Spawn intensity
    *   LOS cones
    *   Navmesh/path display
*   Deterministic replay:

    *   Export `(seed, config, commandStream)` as JSON
    *   Import to replay exact run

---

## 9) Persistence (LocalStorage)

*   `lastConfigJson`
*   `savedPresets[]`
*   `lastSeed`
*   Optional: `replays[]` (bounded ring buffer)

---

## 10) Space Hulk (1993) map import plan

Space Hulk maps are built from modular corridor/room tiles arranged on a square grid, with doors and entry points central to scenario setup. ([BoardGameGeek][2])

### 10.1 Target import format

Define an intermediate “tile assembly” format:

```json
{
  "tileSet": "spacehulk-1993-2e",
  "tiles": [
    {"tileId":"corridor_1x4_A","origin":[10,5],"rotation":90},
    {"tileId":"room_3x3_B","origin":[14,5],"rotation":0}
  ],
  "doors": [{"cell":[13,5],"orientation":"E"}],
  "entryPoints": [{"cell":[2,18],"id":"EP1"}],
  "extraction": {"cell":[30,2]},
  "objectives": [{"kind":"Recover","cells":[[20,9]]}]
}
```

### 10.2 Import pipeline

1.  **Tile definitions library** (manually authored once): each tile is a set of occupied floor cells relative to origin, plus door sockets.
2.  Assemble tiles → rasterize to `CellGrid`.
3.  Validate connectivity, door placement legality, spawn points and objective reachability.
4.  Save as native `MapDefinition` for the engine.

### 10.3 Legal note (practical constraint)

Do not ship copyrighted scans/assets. Keep importer expecting **user-provided** definitions or community-authored *clean-room* tile geometry.

---

## 11) Implementation milestones (tight, prototype-friendly)

1.  **M1: Deterministic engine skeleton**

    *   Tick loop, map grid, LOS stub, pathfinding, MOVE_TO
    *   **Hardcoded Map** initially to prove logic.
2.  **M2: Fog-of-war + basic combat**

    *   Enemies spawn, soldiers shoot, HP/death, extraction + objective completion
3.  **M3: Director + replay/export**

    *   Spawn pressure ramps, record/replay command stream
4.  **M4: Agent harness**

    *   WebWorker bot example + JSON protocol contract tests
5.  **M5: Content-pack pluggability**

    *   Swap director/map generator at runtime; config UI editing
6.  **M6: Advanced UI & Combat Feedback**

    *   **Soldier List Panel**: Right-side panel showing all soldiers, their status, current command, and command queue.
    *   **Keyboard Command Interface**: Menu-driven command issuing (Select Command -> Select Unit -> Target).
    *   **Combat Visuals**: Bullet tracers/lines when units fire.
    *   **Health Bars**: Verified and refined health indicators for all combatants.
    *   **Command Queuing**: Engine support for queuing multiple commands per unit.
7.  **M7: Spaceship Map & Thin Walls**
    *   **Thin Walls**: Refactor engine to support walls *between* cells instead of solid wall tiles.
    *   **Maze Generation**: Procedural generation for tight spaceship corridors (maze-like, max 16x16).
    *   **Visual Scale**: Increase tile size significantly relative to units.

---

## 12) Acceptance criteria (definition of “done” for this GDD)

*   A user can open the page, tweak config, generate a map, and complete/fail a mission.
*   A bot can play the same mission using only the JSON protocol.
*   Any run can be replayed deterministically from exported JSON.
*   Balancing can be changed without editing engine code (content pack swap).
*   UI supports keyboard-driven gameplay and provides clear tactical feedback (soldier list, tracers).
*   Map resembles a tight spaceship interior with edge-based walls.

---

## 13) Agent Debugging & Visual Feedback

*   **Visual Debugging Limitations**: As an AI agent, direct visual inspection of the UI is not possible.
*   **Effective Feedback**: When reporting visual issues, users must provide:
    *   **Highly Detailed Text Descriptions**: Be as precise as possible regarding colors (e.g., "doors are solid yellow, not dark grey as expected for closed state"), dimensions (e.g., "doors are 2 pixels wide instead of 10"), positions (e.g., "door at (3,0)-(3,1)"), and any unexpected visual behavior. Compare against expectations.
    *   **Behavioral Descriptions**: Clearly explain what actions are observed (e.g., "soldier at (1,1) is shooting enemy at (5,5) directly through the wall segment between (2,2) and (3,2)").
    *   **Contextual Information**: Mention the map loaded, unit positions, door states, etc.
*   **Status Display**: The UI should explicitly show when a unit's movement is blocked by a door (e.g., status "Waiting for Door").
*   **Console Output**: Debug logs in the browser console remain critical for understanding runtime state and should be provided when requested.
*   **Agent Browser Environment**: The agent's internal browser operates in a headless environment. If a headful browser is attempted, an X server must be present. When reporting issues, assume the agent is using a headless browser.

---
## 14) Testing and Debugging Strategy
*   **Unit Test First Approach**: For core game mechanics (GameGrid, Pathfinder, LineOfSight, door logic), comprehensive unit tests are paramount.
    *   **Test Maps**: Define small, fixed JSON `MapDefinition`s directly within tests (or load from test assets) to cover specific scenarios:
        *   **Extremely Small Debug Maps**: Create maps as small as 2x2 with minimal features (e.g., 2 floor cells and a wall/door) to isolate and test core mechanics and potential recursion bugs.
        *   Basic open paths.
        *   Paths blocked by walls.
        *   Paths blocked/allowed by doors in various states (Closed, Open, Locked, Destroyed).
        *   Complex wall/door configurations (e.g., corners, multi-segment doors).
    *   **Test Scope**: Unit tests must verify:
        *   `GameGrid.canMove`: Correctly identifies traversable segments based on walls and door states.
        *   `Pathfinder.findPath`: Finds correct paths or returns null when blocked, respecting door states.
        *   `LineOfSight.hasLineOfSight`: Correctly determines visibility, respecting walls and door states.
*   **Iterative Debugging**:
    *   Add debug `console.log` statements strategically in relevant engine code (GameGrid, Pathfinder, LineOfSight, CoreEngine) when a bug is suspected.
    *   Run specific unit tests or controlled browser scenarios.
    *   Analyze console output to pinpoint logical errors.
    *   Remove debug logs once the issue is resolved and tests pass.
*   **Test Execution**: Run tests using `npx vitest run` to ensure non-interactive execution, especially in automated environments. Avoid `npx vitest` without `run` as it defaults to interactive watch mode.
*   **Commit Frequency**: The agent must commit changes after the completion of *every* Beads task.
*   **Game Access URL**: The game is accessible at `http://192.168.20.8:5173/`. This URL should be used for all browser interactions.

---
### Critical Runtime Errors
*   **"Maximum call stack size exceeded"**: Observed in browser console logs during live gameplay. This is a critical error likely indicating infinite recursion. Despite passing unit tests for core mechanics, this runtime error persists and must be addressed immediately, as it will impact core game logic (pathfinding, LOS, door states, unit actions). A full stack trace from the browser console is required for debugging.

---

## 15) Map Viewer App
*   **Purpose**: Develop a separate, standalone web application dedicated to loading and displaying `MapDefinition` JSON.
*   **Features**:
    *   Load `MapDefinition` JSON (via paste or file upload).
    *   Render the map accurately, including cells, walls, doors (with their states), spawn points, extraction, and objectives.
    *   Ability to download the rendered map as a PNG or SVG file.
    *   (Optional but desired) Interactive elements for zooming, panning, and toggling debug overlays (e.g., cell coordinates).
*   **Utility**: This app will be crucial for debugging map definitions, creating test scenarios, and generating visual test assets.