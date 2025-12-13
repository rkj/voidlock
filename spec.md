## GDD: Xenopurge-like Web Prototype (Single Run, No Meta, Pluggable Balance, AI-Friendly)

### 0) Scope and non-goals

**In scope**

* Static single-page web app (no backend).
* Load configurable “content pack” (JSON + optional JS modules) that defines:

  * Map generation (or fixed map)
  * Encounter/spawn director
  * Units (stats, weapons), enemies, objectives
  * Commands available to the player/AI
  * Win/lose conditions and scoring
* Play exactly **one run** (one mission instance). No campaign map, no cabin, no persistent progression.
* Save/load configuration and last-run setup via LocalStorage.
* **Real-Time with Pause** gameplay loop.

**Not in scope (for this prototype)**

* Account system, server authoritative simulation, anti-cheat.
* Long-term progression, shops, recruitments, act gating.
* Cabin exploration / narrative emails.
* Complex UI Frameworks (React/Vue/Angular) - using Vanilla TS + Vite.

---

## 1) High-level player experience

1. **Configure**: choose content pack, adjust tuning sliders (or edit JSON), set squad composition and AI logic profiles.
2. **Generate/Load Map**: procedural map generator or imported map.
3. **Play Mission**:

   * Fog-of-war facility map
   * Squad moves semi-autonomously along assigned routes
   * Player issues discrete commands (move, regroup, focus objective, deploy turret/mine, use medkit, throw grenade)
   * **Real-Time with Pause**: Action flows continuously but can be paused to issue commands.
   * Spawn pressure increases over time (“director”)
4. **End**: success at extraction with objective complete, or fail on wipe / timer / objective failure rules.

---

## 2) Architecture overview

### 2.1 Core modules

* **Engine (Web Worker)**
  Pure logic. Runs in a dedicated **Web Worker** to ensure performance and strictly enforce state isolation. No DOM access. Single source of truth. Potential for WebAssembly future optimization.
* **Renderer/UI (Main Thread)**
  Vanilla TypeScript + HTML5 Canvas. Subscribes to Engine state snapshots and renders. Captures user input and translates to Commands.
* **Content Pack** (data + optional code)
  Defines balancing + generation strategies through interfaces.
* **Bot/Agent Harness**
  Sends commands via JSON protocol, receives observations (snapshots/events) to enable machine players.

### 2.2 Determinism requirement

* Engine must be reproducible given `(seed, contentPackVersion, initialConfig, commandStream)`.
* Use a seeded PRNG owned by engine; content pack generators must accept PRNG instance (never call `Math.random()`).

---

## 3) Simulation model

### 3.1 Time

* **Real-Time with Pause**.
* Fixed timestep simulation: `dt = 100ms` (or similar).
* Engine loop: `for each tick -> updateAI -> applyCommands -> integrateMovement -> resolveCombat -> resolveSpawns -> resolveObjectives -> emitEvents`.
* Pause state halts the tick integration but allows command queuing.

### 3.2 World representation

* Grid of **tiles** (Space Hulk compatibility strongly suggests “square-based” corridors/rooms). Entry points and objectives map cleanly onto squares. Space Hulk’s core maps/tiles are effectively a grid of corridor/room squares with doors and entry areas. ([Order of Gamers][1])
*   **Spaceship Interior:** Tight corridors, "thin walls" between adjacent cells (edge-based), and constrained spaces (no large open areas). Maximum map size 16x16. Map generation should prioritize single-tile tunnels (vertical or horizontal) and mostly 2x2 rooms, avoiding larger, irregular tunnel shapes (e.g., 2x width tunnels). This design is inspired by classic Space Hulk layouts.

**Recommended cell model (tile-based)**

*   `Cell { x,y, type: Floor, walls: { n: bool, e: bool, s: bool, w: bool }, roomId?, doorId? }`

    *   *Note:* `type: Wall` cells are replaced by edge-based walls between Floor cells, though "Void" cells might exist outside the ship hull.

### 3.4 Line of Sight (LOS)
*   **Blocking Entities**: LOS must be blocked by `Wall` cells and `Door` entities in `Closed` or `Locked` states. `Open` or `Destroyed` doors do not block LOS.
*   **Visibility**: Units should only be able to target (attack) and perceive (FOW) entities within their calculated LOS.



**Soldier**



*   `hp, armor, moveSpeed, accuracy, melee, sightRange`

*   `weapon: { damage, range, rof, reload, spread, ammo }`

*   `logicProfile` (behavior policy for autonomous actions)

*   `status`: overwatch-like modes are optional in this prototype; keep minimal: `Idle|Moving|Engaging|Downed|Interacting`

*   `intent`: current route/path, current task



**Enemy**



*   `hp, moveSpeed, damage, behaviorType`

*   Simple archetypes: `SwarmMelee`, `Ambusher`, `Tank` (all defined by content pack)



**Door**







*   `id`: `string` - Unique identifier for the door.



*   `segment`: `Vector2[]` - An array of `Vector2` coordinates defining the cells that are adjacent to the door's barrier segment. (e.g., `[{x:3, y:0}, {x:3, y:1}]` for a vertical door segment between column 2 and 3, spanning rows 0 and 1).



*   `orientation`: `'Horizontal' | 'Vertical'` - Defines if the door segment is horizontal (between rows) or vertical (between columns).



*   `state`: `'Open'|'Closed'|'Locked'|'Destroyed'` - Current state of the door.



*   `hp`: `number` - Current hit points of the door.



*   `maxHp`: `number` - Maximum hit points of the door.



*   `openDuration`: `number` - Time in seconds it takes for the door to open/close.



**Interactables**



*   Loot can be omitted for prototype; focus on objectives + extraction.

*   Interactions have `duration`, `interruptible`, `range`.

---

## 4) AI model (unit autonomy)

### 4.1 Soldier “logic profile”

Implement as a **data-driven finite state machine** (FSM) or behavior tree with content-pack-provided parameters.

Minimum behavior:

* **Threat evaluation**: choose visible target by priority rules.
* **Engagement**:

  * If target in range and line-of-sight: shoot
  * Else: move along route toward assigned destination (or toward last known threat if in “Aggressive” mode)
* **Self-preservation**:

  * If hp below threshold and has medkit: request/auto-use per profile
  * Optional: retreat to nearest safe node

LogicProfile examples:

* `AggressiveRanged`: prefers shooting, advances toward destination, minimal retreat
* `Cautious`: holds corners, retreats on low HP
* `MeleeRush`: closes distance, high melee weight (useful later if you add melee enemies/units)

This aligns with the design constraint that player is managing high-level decisions rather than micro-positioning.

### 4.2 Director (spawn pressure)

A content-pack-defined “director” module:

* Inputs: elapsed time, noise/aggro metrics, objective progress, squad health
* Outputs: spawn events: `{ spawnPointId, enemyType, count, cadence }`

Space Hulk similarity: Genestealers enter from entry points; rules often refer to “entry point squares” and reinforcement timing. ([Order of Gamers][1])
For prototype: implement spawn points as off-map entry queues feeding into corridor squares.

---

## 5) Command system (player + bot)

### 5.1 Command execution contract

* Commands are **the only external control**; everything else is autonomous.
* Each command:

  * Has schema-validated payload
  * Can be rejected with a reason (cooldown, invalid target, no LOS, etc.)
  * Produces deterministic effects

### 5.2 Minimal command set (prototype)

1. `MOVE_TO`
   Assign soldier(s) to a destination cell; engine computes path (A*).
2. `REGROUP`
   Set destination for all soldiers to a rally point or to formation around a leader.
3. `FOCUS_OBJECTIVE`
   Override default behavior to prioritize objective interactions and then extraction.
4. `DEPLOY_TURRET` (optional v1.1)
   Place turret at target cell if valid.
5. `PLACE_MINE` (optional v1.1)
6. `USE_MEDKIT`
   On self or ally in range.
7. `THROW_GRENADE` (optional v1.1)

You can start with only `MOVE_TO`, `REGROUP`, `USE_MEDKIT`, `FOCUS_OBJECTIVE`. Add the rest once the loop feels good.

---

## 6) Engine ↔ Player/Agent JSON protocol

### 6.1 Transport

* In-browser: `postMessage` (Web Worker).
* For bot testing: run bots as WebWorkers or injected scripts.

### 6.2 Observation payload (what agents receive)

Two layers:

* **Full-state snapshot** (debug/training mode)
* **Fogged observation** (real gameplay parity)

Example (fogged):

```json
{
  "t": 123.4,
  "seed": 987654,
  "visible": {
    "soldiers": [{"id":"s1","cell":[10,4],"hp":72,"state":"Moving","task":{"type":"MOVE_TO","cell":[14,9]}}],
    "enemies": [{"id":"e9","cell":[12,4],"hp":30,"type":"SwarmMelee"}],
    "doors": [{"id":"d3","cell":[11,4],"state":"Closed"}],
    "objectives": [{"id":"o1","kind":"Recover","state":"Pending","cells":[[18,10]]}],
    "extraction": {"cell":[2,2]}
  },
  "knownMap": {
    "width": 32,
    "height": 24,
    "discoveredCells": [[10,4],[11,4],[12,4]]
  },
  "events": [
    {"type":"SHOT_FIRED","by":"s1","at":"e9"},
    {"type":"SPAWN","at":[30,2],"enemyType":"SwarmMelee","count":2}
  ]
}
```

### 6.3 Command payload (what agents send)

```json
{
  "t": 123.5,
  "cmd": "MOVE_TO",
  "soldierIds": ["s1","s2"],
  "cell": [14,9]
}
```

Engine response:

```json
{
  "ok": false,
  "rejected": [{"soldierId":"s2","reason":"NO_PATH"}]
}
```

Key design choice: allow partial acceptance per-soldier to keep bots simple.

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



**Director**

* `update(prng, state) -> SpawnPlan[]`

**CombatResolver**

* `resolve(state, dt) -> { damageEvents[], statusEvents[] }`

**Pathfinder**

* `findPath(map, from, to) -> cell[]`

All should be swappable. Default implementations ship with the prototype; content packs can replace any subset.

---

## 8) UI/UX requirements (web)

### 8.1 Views

*   **Config screen**

    *   Load/save pack config JSON
    *   Random seed control
    *   **Map Generator Selection**: Dropdown or similar control to choose between different map generation strategies (e.g., 'Procedural Maze', 'Static Map').
    *   **Load Map Data**: For 'Static Map' selection, provide an input (e.g., text area or file upload) to paste/load map definition JSON.
    *   Squad builder (pick archetypes)
    *   Toggles: fog-of-war, debug overlay, agent control on/off
*   **Mission screen**
    *   Main map (Canvas/WebGL) - Must accurately render the `MapDefinition`, including all Floor/Wall cells and correctly representing thin walls between cells. Doors must be clearly visible and distinguishable by their state (Closed, Open, Locked, Destroyed), with sufficient visual contrast against walls and floors.
    *   Left panel: squad list + status + quick commands
    *   Bottom: timeline/events log (important for debugging director)
    *   Right: objective/extraction status + threat meter

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

## Agent Workflow Instructions

*   **Prioritization**: When a new change request is received, the agent must first update `spec.md` with the new clarification.
*   **Task Creation**: After updating `spec.md`, the agent must create a Beads task for the requested change.
*   **Implementation**: Only after the above steps are completed should the agent proceed with the actual code implementation.
*   **No Pushes**: The agent must *not* push changes to the remote repository without explicit user instruction.
*   **Version Control**: The agent must use `jj` commands exclusively for version control operations (commit, diff, status, etc.), and *never* use `git` commands directly, as this is a `jj` managed repository.
*   **Correction: Re-add missing workflow rule**: The agent must always ensure the rule about "When a new change is requested, first update spec.md with the extra clarification, then create Beads tasks for the implementation" is present in `AGENTS.md`.


### 0) Scope and non-goals

**In scope**

* Static single-page web app (no backend).
* Load configurable “content pack” (JSON + optional JS modules) that defines:

  * Map generation (or fixed map)
  * Encounter/spawn director
  * Units (stats, weapons), enemies, objectives
  * Commands available to the player/AI
  * Win/lose conditions and scoring
* Play exactly **one run** (one mission instance). No campaign map, no cabin, no persistent progression.
* Save/load configuration and last-run setup via LocalStorage.
* **Real-Time with Pause** gameplay loop.

**Not in scope (for this prototype)**

* Account system, server authoritative simulation, anti-cheat.
* Long-term progression, shops, recruitments, act gating.
* Cabin exploration / narrative emails.
* Complex UI Frameworks (React/Vue/Angular) - using Vanilla TS + Vite.

---

## 1) High-level player experience

1. **Configure**: choose content pack, adjust tuning sliders (or edit JSON), set squad composition and AI logic profiles.
2. **Generate/Load Map**: procedural map generator or imported map.
3. **Play Mission**:

   * Fog-of-war facility map
   * Squad moves semi-autonomously along assigned routes
   * Player issues discrete commands (move, regroup, focus objective, deploy turret/mine, use medkit, throw grenade)
   * **Real-Time with Pause**: Action flows continuously but can be paused to issue commands.
   * Spawn pressure increases over time (“director”)
4. **End**: success at extraction with objective complete, or fail on wipe / timer / objective failure rules.

---

## 2) Architecture overview

### 2.1 Core modules

* **Engine (Web Worker)**
  Pure logic. Runs in a dedicated **Web Worker** to ensure performance and strictly enforce state isolation. No DOM access. Single source of truth. Potential for WebAssembly future optimization.
* **Renderer/UI (Main Thread)**
  Vanilla TypeScript + HTML5 Canvas. Subscribes to Engine state snapshots and renders. Captures user input and translates to Commands.
* **Content Pack** (data + optional code)
  Defines balancing + generation strategies through interfaces.
* **Bot/Agent Harness**
  Sends commands via JSON protocol, receives observations (snapshots/events) to enable machine players.

### 2.2 Determinism requirement

* Engine must be reproducible given `(seed, contentPackVersion, initialConfig, commandStream)`.
* Use a seeded PRNG owned by engine; content pack generators must accept PRNG instance (never call `Math.random()`).

---

## 3) Simulation model

### 3.1 Time

* **Real-Time with Pause**.
* Fixed timestep simulation: `dt = 100ms` (or similar).
* Engine loop: `for each tick -> updateAI -> applyCommands -> integrateMovement -> resolveCombat -> resolveSpawns -> resolveObjectives -> emitEvents`.
* Pause state halts the tick integration but allows command queuing.

### 3.2 World representation

* Grid of **tiles** (Space Hulk compatibility strongly suggests “square-based” corridors/rooms). Entry points and objectives map cleanly onto squares. Space Hulk’s core maps/tiles are effectively a grid of corridor/room squares with doors and entry areas. ([Order of Gamers][1])
* **Spaceship Interior:** Tight corridors, "thin walls" between adjacent cells (edge-based), and constrained spaces (no large open areas). Maximum map size 16x16.

**Recommended cell model (tile-based)**

* `Cell { x,y, type: Floor, walls: { n: bool, e: bool, s: bool, w: bool }, roomId?, doorId?, tags[] }`
    * *Note:* `type: Wall` cells are replaced by edge-based walls between Floor cells, though "Void" cells might exist outside the ship hull.
* Doors are edges or cell features: `Door { id, cell, orientation, state: Open|Closed|Destroyed }`
* Spawns: `SpawnPoint { id, cell, kind: EnemyEntry }`
* Extraction: `ExtractionPoint { cell }`
* Objective(s): `Objective { id, cell(s), kind, state }`

### 3.3 Entities

**Soldier**

* `hp, armor, moveSpeed, accuracy, melee, sightRange`
* `weapon: { damage, range, rof, reload, spread, ammo }`
* `logicProfile` (behavior policy for autonomous actions)
* `status`: overwatch-like modes are optional in this prototype; keep minimal: `Idle|Moving|Engaging|Downed|Interacting`
* `intent`: current route/path, current task

**Enemy**

* `hp, moveSpeed, damage, behaviorType`
* Simple archetypes: `SwarmMelee`, `Ambusher`, `Tank` (all defined by content pack)

**Interactables**

* Loot can be omitted for prototype; focus on objectives + extraction.
* Interactions have `duration`, `interruptible`, `range`.

---

## 4) AI model (unit autonomy)

### 4.1 Soldier “logic profile”

Implement as a **data-driven finite state machine** (FSM) or behavior tree with content-pack-provided parameters.

Minimum behavior:

* **Threat evaluation**: choose visible target by priority rules.
* **Engagement**:

  * If target in range and line-of-sight: shoot
  * Else: move along route toward assigned destination (or toward last known threat if in “Aggressive” mode)
* **Self-preservation**:

  * If hp below threshold and has medkit: request/auto-use per profile
  * Optional: retreat to nearest safe node

LogicProfile examples:

* `AggressiveRanged`: prefers shooting, advances toward destination, minimal retreat
* `Cautious`: holds corners, retreats on low HP
* `MeleeRush`: closes distance, high melee weight (useful later if you add melee enemies/units)

This aligns with the design constraint that player is managing high-level decisions rather than micro-positioning.

### 4.2 Director (spawn pressure)

A content-pack-defined “director” module:

* Inputs: elapsed time, noise/aggro metrics, objective progress, squad health
* Outputs: spawn events: `{ spawnPointId, enemyType, count, cadence }`

Space Hulk similarity: Genestealers enter from entry points; rules often refer to “entry point squares” and reinforcement timing. ([Order of Gamers][1])
For prototype: implement spawn points as off-map entry queues feeding into corridor squares.

---

## 5) Command system (player + bot)

### 5.1 Command execution contract

* Commands are **the only external control**; everything else is autonomous.
* Each command:

  * Has schema-validated payload
  * Can be rejected with a reason (cooldown, invalid target, no LOS, etc.)
  * Produces deterministic effects

### 5.2 Minimal command set (prototype)

1. `MOVE_TO`
   Assign soldier(s) to a destination cell; engine computes path (A*).
2. `REGROUP`
   Set destination for all soldiers to a rally point or to formation around a leader.
3. `FOCUS_OBJECTIVE`
   Override default behavior to prioritize objective interactions and then extraction.
4. `DEPLOY_TURRET` (optional v1.1)
   Place turret at target cell if valid.
5. `PLACE_MINE` (optional v1.1)
6. `USE_MEDKIT`
   On self or ally in range.
7. `THROW_GRENADE` (optional v1.1)

You can start with only `MOVE_TO`, `REGROUP`, `USE_MEDKIT`, `FOCUS_OBJECTIVE`. Add the rest once the loop feels good.

---

## 6) Engine ↔ Player/Agent JSON protocol

### 6.1 Transport

* In-browser: `postMessage` (Web Worker).
* For bot testing: run bots as WebWorkers or injected scripts.

### 6.2 Observation payload (what agents receive)

Two layers:

* **Full-state snapshot** (debug/training mode)
* **Fogged observation** (real gameplay parity)

Example (fogged):

```json
{
  "t": 123.4,
  "seed": 987654,
  "visible": {
    "soldiers": [{"id":"s1","cell":[10,4],"hp":72,"state":"Moving","task":{"type":"MOVE_TO","cell":[14,9]}}],
    "enemies": [{"id":"e9","cell":[12,4],"hp":30,"type":"SwarmMelee"}],
    "doors": [{"id":"d3","cell":[11,4],"state":"Closed"}],
    "objectives": [{"id":"o1","kind":"Recover","state":"Pending","cells":[[18,10]]}],
    "extraction": {"cell":[2,2]}
  },
  "knownMap": {
    "width": 32,
    "height": 24,
    "discoveredCells": [[10,4],[11,4],[12,4]]
  },
  "events": [
    {"type":"SHOT_FIRED","by":"s1","at":"e9"},
    {"type":"SPAWN","at":[30,2],"enemyType":"SwarmMelee","count":2}
  ]
}
```

### 6.3 Command payload (what agents send)

```json
{
  "t": 123.5,
  "cmd": "MOVE_TO",
  "soldierIds": ["s1","s2"],
  "cell": [14,9]
}
```

Engine response:

```json
{
  "ok": false,
  "rejected": [{"soldierId":"s2","reason":"NO_PATH"}]
}
```

Key design choice: allow partial acceptance per-soldier to keep bots simple.

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

* `generate(prng, config) -> MapDefinition`
* `validate(map) -> issues[]`

**Director**

* `update(prng, state) -> SpawnPlan[]`

**CombatResolver**

* `resolve(state, dt) -> { damageEvents[], statusEvents[] }`

**Pathfinder**

* `findPath(map, from, to) -> cell[]`

All should be swappable. Default implementations ship with the prototype; content packs can replace any subset.

---

## 8) UI/UX requirements (web)

### 8.1 Views

* **Config screen**

  * Load/save pack config JSON
  * Random seed control
  * Squad builder (pick archetypes)
  * Toggles: fog-of-war, debug overlay, agent control on/off
* **Mission screen**

  * Main map (Canvas/WebGL)
  * Left panel: squad list + status + quick commands
  * Bottom: timeline/events log (important for debugging director)
  * Right: objective/extraction status + threat meter

### 8.2 Debug affordances (non-negotiable for balancing)

* Toggle “show all” (disable fog) for quick iteration.
* Heatmaps/overlays:

  * Spawn intensity
  * LOS cones
  * Navmesh/path display
* Deterministic replay:

  * Export `(seed, config, commandStream)` as JSON
  * Import to replay exact run

---

## 9) Persistence (LocalStorage)

* `lastConfigJson`
* `savedPresets[]`
* `lastSeed`
* Optional: `replays[]` (bounded ring buffer)

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

1. **Tile definitions library** (manually authored once): each tile is a set of occupied floor cells relative to origin, plus door sockets.
2. Assemble tiles → rasterize to `CellGrid`.
3. Validate connectivity, door placement legality, spawn points and objective reachability.
4. Save as native `MapDefinition` for the engine.

### 10.3 Legal note (practical constraint)

Do not ship copyrighted scans/assets. Keep importer expecting **user-provided** definitions or community-authored *clean-room* tile geometry.

---

## 11) Implementation milestones (tight, prototype-friendly)

1. **M1: Deterministic engine skeleton**

   * Tick loop, map grid, LOS stub, pathfinding, MOVE_TO
   * **Hardcoded Map** initially to prove logic.
2. **M2: Fog-of-war + basic combat**

   * Enemies spawn, soldiers shoot, HP/death, extraction + objective completion
3. **M3: Director + replay/export**

   * Spawn pressure ramps, record/replay command stream
4. **M4: Agent harness**

   * WebWorker bot example + JSON protocol contract tests
5. **M5: Content-pack pluggability**

   * Swap director/map generator at runtime; config UI editing
6. **M6: Advanced UI & Combat Feedback**

   * **Soldier List Panel**: Right-side panel showing all soldiers, their status, current command, and command queue.
   * **Keyboard Command Interface**: Menu-driven command issuing (Select Command -> Select Unit -> Target).
   * **Combat Visuals**: Bullet tracers/lines when units fire.
   * **Health Bars**: Verified and refined health indicators for all combatants.
   * **Command Queuing**: Engine support for queuing multiple commands per unit.
7. **M7: Spaceship Map & Thin Walls**
   * **Thin Walls**: Refactor engine to support walls *between* cells instead of solid wall tiles.
   * **Maze Generation**: Procedural generation for tight spaceship corridors (maze-like, max 16x16).
   * **Visual Scale**: Increase tile size significantly relative to units.

---

## 12) Acceptance criteria (definition of “done” for this GDD)

* A user can open the page, tweak config, generate a map, and complete/fail a mission.
* A bot can play the same mission using only the JSON protocol.
* Any run can be replayed deterministically from exported JSON.
* Balancing can be changed without editing engine code (content pack swap).
* UI supports keyboard-driven gameplay and provides clear tactical feedback (soldier list, tracers).
* Map resembles a tight spaceship interior with edge-based walls.
