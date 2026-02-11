# Voidlock Architecture

**Version:** 1.0
**Last Updated:** 2026-02-06

## Overview

Voidlock is a single-player, Real-Time with Pause (RTwP) tactical squad combat game built for the web. The architecture follows a strict separation between simulation logic (deterministic, Web Worker-based) and presentation (Canvas-based UI).

This document describes the high-level module boundaries, state flow, and rendering pipeline. For detailed specifications, refer to:

- [Simulation & Protocol](docs/spec/simulation.md)
- [World Model & Map](docs/spec/map.md)
- [User Interface](docs/spec/ui.md)
- [Command System & AI](docs/spec/commands.md)

---

## 1. Module Boundaries

The codebase is organized into four primary modules, each with strict responsibilities:

### 1.1 `src/engine/`

**Responsibility:** Core game simulation (deterministic, isolated, Web Worker).

**Key Components:**

- **Game Loop:** Fixed-timestep simulation (60Hz or configurable tick rate)
- **Game State:** Authoritative world state (units, map, objectives, fog of war)
- **Pathfinding:** A\* or Dijkstra-based grid navigation
- **Line of Sight (LOS):** Raycasting for visibility and line-of-fire
- **Combat System:** Weapon firing, damage resolution, accuracy calculations
- **AI Director:** Enemy spawning algorithm (pacing, threat scaling)
- **Command Processing:** Validates and executes player/AI commands
- **PRNG (Determinism):** Seeded random number generator (no `Math.random()`)
- **Protocol Handler:** Serializes/deserializes messages to/from main thread

**Constraints:**

- **No DOM access** (runs in Web Worker context)
- **No side effects** beyond state mutations
- **Pure functions** for all simulation logic where possible
- **Deterministic:** Same inputs (seed, commands, config) always produce identical outputs

**Exports:**

- `GameEngine` class (main entry point for worker)
- `GameState` interface (serializable world snapshot)
- Core types: `Unit`, `MapDefinition`, `Command`, `WorldState`

**Testing:**

- Unit tests for all core mechanics (Grid, Pathfinder, LOS, Combat)
- Integration tests using micro-maps (2x2 grids)
- Regression tests for bug fixes (`regression_<ticket_id>_<slug>.test.ts`)

---

### 1.2 `src/ui/`

**Responsibility:** Presentation layer (Canvas rendering, input handling, screen flow).

**Key Components:**

- **Canvas Renderer:** 2D top-down grid rendering with layered z-index
  - Background: Floor tiles, walls, static decals
  - Ground Decals: Extraction zones, spawn points, objectives, loot
  - Units: Soldiers, enemies, projectiles
  - Fog of War: Shroud overlay
  - UI Overlays: Selection rings, health bars, movement paths, damage numbers
- **Screen Manager:** Orchestrates screen transitions
  - Main Menu
  - Mission Setup (Config)
  - Squad Management & Loadout
  - Mission Screen (Active Gameplay)
  - Debrief Screen (Post-Mission)
  - Campaign Shell (Sector Map, Barracks, Statistics)
  - Settings Screen (Global)
- **Input Handler:** Keyboard/mouse event processing
  - Command menu navigation (hierarchical state machine)
  - Drag-and-drop (squad deployment, equipment)
  - Camera controls (pan, zoom)
- **UI Components:** Reusable widgets
  - Soldier Cards (stats, health, tactical number)
  - Equipment Inspector (paper doll)
  - Objective List
  - Resource Header (Scrap, Intel)
  - Modal System (confirmations, errors)
- **Worker Bridge:** Message passing to/from engine worker
  - Sends `Command` objects (MOVE, ATTACK, USE_ITEM, etc.)
  - Receives `WorldState` snapshots (every tick or on-demand)
  - Handles session lifecycle (INIT, PAUSE, RESET)

**Constraints:**

- **No simulation logic** (all game rules live in `src/engine/`)
- **No direct state mutation** (UI is read-only consumer of `WorldState`)
- **Vanilla TypeScript** (no React/Vue/Angular)
- **Accessibility:** Fully keyboard-navigable

**Exports:**

- `CanvasRenderer` class
- `ScreenManager` class
- UI component functions (e.g., `renderSoldierCard()`, `renderCommandMenu()`)
- Input event handlers

**Testing:**

- Visual regression tests (Playwright screenshots)
- Integration tests for command menu state machine
- E2E tests for full user flows (squad deployment, mission completion)

---

### 1.3 `src/content/`

**Responsibility:** Data definitions (Content Packs, maps, archetypes).

**Key Components:**

- **Content Pack Definitions:** JSON schemas for game data
  - `pack.json`: Top-level manifest (version, rules, archetypes)
  - `soldierArchetypes`: Unit stats (Speed, Health, Aim)
  - `enemyArchetypes`: Enemy stats, behaviors
  - `weaponDefinitions`: Damage, fire rate, range, accuracy
  - `itemDefinitions`: Usable items (grenades, medkits, mines)
  - `missionTemplates`: Objective types, win/loss conditions
- **Map Definitions:** Static or procedural map data
  - Grid dimensions, cell types (Floor, Void)
  - Wall/door placements
  - Entity spawn points (squad, enemies, objectives, extraction)
- **ASCII Map Parser:** Converts human-readable ASCII to `MapDefinition`
- **Validation:** Schema validation for content packs

**Constraints:**

- **Pure data** (no logic, no class instances)
- **JSON-serializable** (for network transport, persistence)
- **Immutable at runtime** (loaded once, never mutated)
- **Versioned:** Content packs include semantic version (e.g., `"0.1.0"`)

**Exports:**

- `ContentPack` interface
- `MapDefinition` interface
- `loadContentPack(id: string): Promise<ContentPack>`
- `parseASCIIMap(ascii: string): MapDefinition`
- Default content pack (`default-pack.json`)

**Testing:**

- Schema validation tests
- ASCII map parser tests (roundtrip: ASCII -> MapDefinition -> ASCII)
- Content pack integrity tests (no duplicate IDs, valid references)

---

### 1.4 `src/shared/`

**Responsibility:** Cross-cutting utilities and types shared across modules.

**Key Components:**

- **Types:** Core TypeScript interfaces/enums
  - `Vector2`: `{x: number, y: number}`
  - `UnitState`: `"Idle" | "Moving" | "Firing" | "Channeling" | "Dead"`
  - `Command`: Discriminated union of all command types
  - `WorldState`: Full engine snapshot (units, map, objectives, FOW)
- **Constants:** Global configuration values
  - `SPEED_NORMALIZATION_CONST = 30`: Movement/timed action scaling factor
  - `DEFAULT_TICK_MS = 100`: Simulation timestep
  - `MAX_LOS_RANGE = 10`: Default line-of-sight radius
- **Utilities:** Pure helper functions
  - `distance(a: Vector2, b: Vector2): number`
  - `clamp(value: number, min: number, max: number): number`
  - `seedRandom(seed: number): () => number` (PRNG factory)
  - `serializeCommand(cmd: Command): string` (for replay logs)
- **Protocol Definitions:** Message types for Worker ↔ Main communication
  - `EngineMessage`: Main → Worker (INIT, COMMAND, QUERY_STATE, TOGGLE_DEBUG)
  - `UIMessage`: Worker → Main (STATE_UPDATE, MISSION_COMPLETE, ERROR)

**Constraints:**

- **No dependencies on other modules** (`engine`, `ui`, `content` depend on `shared`, not vice versa)
- **Pure functions only** (no side effects, no I/O)
- **Minimal dependencies** (prefer standard library over external packages)

**Exports:**

- All shared types, constants, utilities

**Testing:**

- Unit tests for all utility functions
- Type-level tests (TypeScript compilation checks)

---

## 2. Web Worker Split

### 2.1 Architecture

The simulation runs in a dedicated **Web Worker** to ensure:

1. **Determinism:** Isolated context, no accidental DOM/network side effects
1. **Performance:** Offloads CPU-intensive logic (pathfinding, LOS) from UI thread
1. **Responsiveness:** UI remains interactive even during heavy computation

**Main Thread (UI):**

- Renders Canvas frames (60 FPS, decoupled from simulation tick rate)
- Handles user input (keyboard, mouse)
- Manages screen flow (menus, settings, campaign)
- Stores local state (LocalStorage: config, replays, campaign saves)

**Worker Thread (Engine):**

- Runs fixed-timestep game loop (default 100ms per tick)
- Processes commands from main thread
- Emits `WorldState` snapshots to main thread (every tick or on-demand)
- Maintains authoritative game state (units, map, objectives, FOW)

### 2.2 Message Protocol

**Main → Worker (EngineMessage):**

```typescript
type EngineMessage =
  | {
      type: "INIT";
      config: MissionConfig;
      contentPack: ContentPack;
      seed: number;
    }
  | { type: "COMMAND"; commands: Command[] }
  | { type: "QUERY_STATE" }
  | { type: "TOGGLE_DEBUG"; enabled: boolean }
  | { type: "SET_SPEED"; scale: number } // 0.1x - 10.0x, or 0 for pause
  | { type: "RESET" };
```

**Worker → Main (UIMessage):**

```typescript
type UIMessage =
  | { type: "STATE_UPDATE"; state: WorldState; tick: number }
  | {
      type: "MISSION_COMPLETE";
      result: "VICTORY" | "DEFEAT";
      stats: MissionStats;
    }
  | { type: "ERROR"; message: string }
  | { type: "DEBUG_INFO"; data: any }; // For debug overlay
```

### 2.3 State Synchronization

- **Push Model:** Worker pushes `STATE_UPDATE` every tick (or every N ticks for performance)
- **Pull Model:** Main can request on-demand state via `QUERY_STATE` (e.g., for pause menu, debug export)
- **Command Batching:** Main batches commands issued within a single frame and sends as array
- **Replay Log:** Worker maintains command history for deterministic replay

### 2.4 Initialization Flow

1. **Main:** User configures mission (map, squad, content pack, seed)
1. **Main → Worker:** Send `INIT` message with config
1. **Worker:** Load content pack, generate/parse map, spawn units, initialize PRNG
1. **Worker → Main:** Send initial `STATE_UPDATE` (tick 0)
1. **Main:** Render initial state, enable input
1. **Main → Worker:** Send `SET_SPEED` (start simulation at 1.0x)
1. **Worker:** Begin game loop, process ticks, emit state updates
1. **Main:** Render interpolated frames at 60 FPS

### 2.5 Session Transitions

**Mission Start (INIT):**

- Main clears previous `WorldState` snapshots
- UI resets (command menu, soldier cards, objective list)
- Camera resets to default position (squad focus)
- Debug overlays cleared

**Mission End (MISSION_COMPLETE):**

- Worker stops game loop
- Worker emits final `STATE_UPDATE` and `MISSION_COMPLETE` message
- Main transitions to Debrief Screen
- Replay data saved to LocalStorage (ring buffer, max 10 replays)

**Return to Menu:**

- Main sends `RESET` to worker
- Worker terminates game loop, releases resources
- Main clears UI overlays (game over summary, pause overlay)
- Replay background process stopped (if running)

---

## 3. State Flow

### 3.1 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Main Thread (UI)                      │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Input       │───▶│  Command     │───▶│  Worker      │  │
│  │  Handler     │    │  Builder     │    │  Bridge      │  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘  │
│                                                   │          │
│                                                   │ postMessage
│                                                   │          │
└───────────────────────────────────────────────────┼──────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────┐
│                     Worker Thread (Engine)                   │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Message     │───▶│  Command     │───▶│  Game        │  │
│  │  Handler     │    │  Processor   │    │  Loop        │  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘  │
│                                                   │          │
│                                                   │ update() │
│                                                   │          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────▼───────┐  │
│  │  State       │◀───│  World       │◀───│  Systems     │  │
│  │  Serializer  │    │  State       │    │  (AI, LOS,   │  │
│  └──────┬───────┘    └──────────────┘    │   Combat)    │  │
│         │                                 └──────────────┘  │
│         │ postMessage                                       │
│         │                                                   │
└─────────┼───────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                        Main Thread (UI)                      │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Message     │───▶│  State       │───▶│  Canvas      │  │
│  │  Handler     │    │  Buffer      │    │  Renderer    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 State Ownership

| State Type                 | Owner  | Mutability                     | Sync Method       |
| -------------------------- | ------ | ------------------------------ | ----------------- |
| **Game State** (canonical) | Worker | Mutable (via commands)         | Push (every tick) |
| **UI State** (snapshot)    | Main   | Read-only (replaced each tick) | Pull (on message) |
| **Input State**            | Main   | Mutable (event handlers)       | N/A (local only)  |
| **Config State**           | Main   | Mutable (settings, squad)      | INIT message      |
| **Replay Log**             | Worker | Append-only (command history)  | Pull (on export)  |
| **Campaign Save**          | Main   | Mutable (LocalStorage)         | N/A (local only)  |

### 3.3 Command Flow (User Input → Simulation)

1. **User Input:** Keyboard press (e.g., `1` for "Orders" menu)
1. **Input Handler:** Updates local menu state (e.g., `menuState = "ORDERS_SELECT"`)
1. **User Selection:** User selects target + unit (e.g., "Move to Room A" + "Unit 1")
1. **Command Builder:** Constructs `Command` object:
   ```typescript
   {
     type: "MOVE_TO",
     unitId: "soldier_1",
     target: { x: 12, y: 8 }, // Room A center
     queueMode: "REPLACE" // or "APPEND" if Shift held
   }
   ```
1. **Worker Bridge:** Posts message to worker thread
1. **Worker Message Handler:** Parses message, validates command
1. **Command Processor:** Adds command to unit's queue
1. **Game Loop:** Processes command on next tick (pathfinding, movement)
1. **State Serializer:** Emits updated `WorldState`
1. **Main Message Handler:** Receives state, updates UI state buffer
1. **Canvas Renderer:** Draws next frame (60 FPS, interpolated if needed)

### 3.4 Tick Processing (Worker Internal)

**Per-Tick Update Sequence:**

1. **Early Exit:** If `scaledDt` is 0 (paused), return immediately
1. **Director Update:** Check spawn timers, spawn enemies if conditions met
1. **Door Logic:** Update door animations/states (opening, closing)
1. **Visibility:** Recalculate LOS for all units (raycasting)
1. **Mission:** Update objective progress, check win/loss conditions
1. **Units:** Process movement, action timers, state transitions
1. **Combat:** Resolve weapon fire, apply damage, check deaths
1. **State Snapshot:** Serialize `WorldState`, emit to main thread

**Time Handling:**

- `scaledDt` (Game Time): Affected by speed slider (0.1x - 10.0x)
  - Unit movement
  - Combat cooldowns
  - Timed actions (Extracting, Pickup)
  - Director pacing (enemy spawning)
- `realDt` (Real Time): Constant (Note: Most systems now use `scaledDt`)

---

## 4. Render Pipeline

### 4.1 Layering (Z-Index Order)

The Canvas renderer draws layers from back to front:

1. **Background Layer:**
   - Floor tiles (walkable cells)
   - Void cells (impassable space)
   - Wall geometry (edges between cells)
   - Static decals (stains, debris)

1. **Ground Decal Layer:**
   - Extraction Zone (green grid overlay)
   - Enemy Spawn Points (vents/crosshairs)
   - Objectives (data disks, artifacts)
   - Loot Crates (scrap, items)
   - **Note:** Entities on this layer respect Fog of War (only visible if cell is Discovered)

1. **Unit Layer (Dynamic):**
   - Soldiers (friendly units)
   - Enemies (hostile units)
   - Projectiles (bullets, grenades)
   - **Note:** Units obscure ground decals (e.g., soldier standing on spawn point hides the spawn icon)

1. **Fog of War (Shroud):**
   - Black overlay for undiscovered cells
   - Semi-transparent "fog" for explored-but-not-visible cells (Classic mode)
   - **Note:** Hardcore mode returns cells to "unknown" state when out of LOS

1. **Overlay Layer (UI):**
   - Selection rings (squad selection)
   - Health bars (HP, status icons)
   - Movement paths (ghost trail)
   - Floating text (damage numbers, "+10 Scrap")
   - Objective markers (HUD icons)
   - Debug overlays (coordinates, LOS rays)

### 4.2 Visual Modes

The game supports two visual styles (user-configurable in Global Settings):

**1. Tactical Icons (Default):**

- Abstract geometric shapes (triangles, circles, squares)
- High contrast, color-coded
- Soldiers: Green triangles
- Enemies: Red circles
- Objectives: Blue squares
- Extraction: Green grid
- Spawn Points: Red crosshairs

**2. Sprites:**

- WebP images with alpha channel
- Asset scale: ~30% of raw size (38-40px on 128px grid)
- Tactical numbers overlaid on sprites (mission-specific)
- Extraction: Waypoint sprite
- Spawn Points: Vent sprite
- Objectives: Data disk sprite
- Loot: Crate sprite

**Debug Mode:**

- Grid coordinates overlaid on cells
- Full visibility (bypasses Fog of War)
- LOS raycasts visualized (green lines for visible, red for blocked)
- Entity IDs displayed

### 4.3 Rendering Techniques

**Grid Rendering:**

- Each cell is a rectangle (e.g., 64x64px at 1.0 zoom)
- Walls are thin lines drawn on cell edges (not thick blocks)
- Doors occupy middle 1/3 of edge (outer 1/3 are "struts" that block LOS/LOF)

**Unit Rendering:**

- Units positioned at cell centers (e.g., `(x + 0.5, y + 0.5) * cellSize`)
- Interpolation between ticks for smooth movement (60 FPS render, 10 Hz tick)
- Facing direction indicated by orientation (sprite rotation or icon arrow)

**Fog of War Rendering:**

- **Full Visibility:** No fog (debug/easy mode)
- **Classic (Shroud):**
  - Undiscovered: Black (`rgba(0, 0, 0, 1.0)`)
  - Discovered but not visible: Static map geometry visible, no entities
  - Visible: Full color, all entities visible
- **Hardcore:**
  - Undiscovered: Black
  - Out of LOS: Black (even if previously discovered)
  - Visible: Full color

**Performance Optimizations:**

- Dirty rectangle tracking (only redraw changed regions)
- Offscreen canvas for static layers (floor, walls)
- Entity culling (don't render entities outside viewport)
- Sprite atlases (single texture for all unit types)

### 4.4 Camera System

- **Pan:** Arrow keys or mouse drag (middle button)
- **Zoom:** Mouse wheel (0.5x - 2.0x)
- **Focus:** Double-click unit to center camera
- **Bounds:** Camera clamped to map extents (no scrolling into void)
- **Reset:** On mission start, camera centers on squad spawn zone

---

## 5. Determinism & Replay

### 5.1 Requirements

A mission is fully reproducible from:

- **Seed:** PRNG seed (e.g., `785411`)
- **Content Pack:** Version and ID (e.g., `"default-pack@0.1.0"`)
- **Config:** Map generator, dimensions, squad loadout, mission type
- **Command Log:** Ordered list of `{tick, command}` pairs

### 5.2 PRNG (Pseudo-Random Number Generator)

- **Seeded:** Initialized with user-provided or auto-generated seed
- **Deterministic:** Same seed + same calls → same sequence
- **Isolated:** Worker owns PRNG, main thread never calls it
- **No `Math.random()`:** Forbidden in engine code (non-deterministic)

**Implementation:**

- Use established algorithm (e.g., Mulberry32, SFC32)
- Expose as `prng.next(): number` (returns 0.0 - 1.0)
- Include seed in `WorldState` export for debugging

### 5.3 Replay System

**Recording:**

- Worker maintains append-only log: `{tick: number, command: Command}[]`
- Saved to LocalStorage on mission complete (ring buffer, max 10 replays)

**Playback:**

1. Main sends `INIT` with original config + seed
1. Main sends `COMMAND` messages at exact ticks from log
1. Worker processes normally (no special "replay mode" needed)
1. Output `WorldState` sequence matches original run

**Export Format:**

```typescript
{
  "version": "1.0.0",
  "timestamp": "2026-02-06T20:45:00Z",
  "seed": 785411,
  "contentPack": "default-pack@0.1.0",
  "config": { /* MissionConfig */ },
  "commandLog": [
    { "tick": 0, "command": { "type": "INIT", /* ... */ } },
    { "tick": 10, "command": { "type": "MOVE_TO", /* ... */ } },
    // ...
  ],
  "finalState": { /* WorldState at mission end */ }
}
```

### 5.4 Debug Snapshot ("Copy World State")

Accessible via Debug Overlay (`~` key):

- Button in HUD labeled "Copy World State"
- Captures full `WorldState` + replay data + config
- Copies JSON to clipboard (or console if clipboard unavailable)
- Useful for bug reports, sharing tactical scenarios

---

## 6. Content Pack System

### 6.1 Purpose

Content Packs decouple game data (units, weapons, maps) from game logic, enabling:

- **Modding:** Community-created content without code changes
- **Balancing:** Adjust stats via JSON edits, no recompile
- **Versioning:** Track balance changes, support multiple content versions

### 6.2 Structure

**Root Manifest (`pack.json`):**

```json
{
  "id": "default-pack",
  "version": "0.1.0",
  "rules": {
    "tickMs": 100,
    "fogOfWar": true,
    "lineOfSight": { "type": "gridRaycast", "maxRange": 10 }
  },
  "soldierArchetypes": {
    /* ... */
  },
  "enemyArchetypes": {
    /* ... */
  },
  "weaponDefinitions": {
    /* ... */
  },
  "itemDefinitions": {
    /* ... */
  },
  "missionTemplates": {
    /* ... */
  }
}
```

**Soldier Archetype Example:**

```json
{
  "id": "assault",
  "name": "Assault Soldier",
  "baseStats": {
    "hp": 100,
    "speed": 30, // 1.0 tile/sec at 1x game speed
    "aim": 75, // Base accuracy (%)
    "armor": 10
  },
  "defaultLoadout": {
    "rightHand": "pulse_rifle",
    "leftHand": "combat_knife",
    "body": "tactical_vest",
    "feet": "boots"
  }
}
```

**Weapon Definition Example:**

```json
{
  "id": "pulse_rifle",
  "name": "M41A Pulse Rifle",
  "type": "ranged",
  "damage": 25,
  "fireRate": 3.0, // rounds per second
  "range": 8, // tiles
  "accuracy": 0.85, // base multiplier
  "dispersion": 5 // angular dispersion (degrees)
}
```

### 6.3 Loading & Validation

1. **Load:** Main thread fetches `pack.json` (HTTP or LocalStorage)
1. **Validate:** Check schema (required fields, type constraints)
1. **Resolve References:** Ensure all IDs exist (e.g., weapon IDs in loadouts)
1. **Pass to Worker:** Send full pack in `INIT` message (no re-fetch in worker)

### 6.4 Map Definitions

**Static Maps:**

- Included in content pack or loaded separately
- ASCII or JSON format (see [Map Spec](docs/spec/map.md))
- Includes walls, doors, spawn points, objectives

**Procedural Maps:**

- Generated by `TreeShipGenerator` or `DenseShipGenerator`
- Seed determines layout (deterministic)
- Config specifies: dimensions, room count, corridor width, spawn points

---

## 7. Testing Strategy

### 7.1 Unit Tests (`src/engine/`)

- **Pure Logic:** Grid math, pathfinding, LOS raycasting, combat calculations
- **Micro-Maps:** Small, fixed test maps (2x2 grids) for edge cases
- **PRNG:** Verify determinism (same seed → same output)
- **Regression Tests:** Named `regression_<ticket_id>_<slug>.test.ts`

**Example:**

```typescript
describe("Pathfinding", () => {
  it("finds shortest path in 2x2 grid", () => {
    const map = createTestMap(/* 2x2 floor grid */);
    const path = findPath(map, { x: 0, y: 0 }, { x: 1, y: 1 });
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
  });
});
```

### 7.2 Integration Tests (`src/ui/`)

- **Command Menu:** State machine transitions (Action → Orders → Target → Unit)
- **Worker Bridge:** Message round-trip (Main → Worker → Main)
- **State Synchronization:** Verify UI updates on `STATE_UPDATE`

### 7.3 Visual Tests (Playwright)

- **Screenshot Comparison:** Capture canvas before/after changes
- **Layout Verification:** Check soldier cards, command menu, debrief screen
- **Fog of War:** Verify shroud rendering (Classic vs Hardcore)

**Example:**

```typescript
test("soldier deploys to spawn point", async ({ page }) => {
  await page.goto("http://192.168.20.8:5173/");
  await page.click("button:text('Custom Mission')");
  // Drag soldier to spawn point
  await page.dragAndDrop("#soldier_1", ".spawn-point");
  await page.screenshot({ path: "deployment.png" });
  // Visual regression check
});
```

### 7.4 E2E Tests

- **Full Mission Flow:** Setup → Deploy → Mission → Debrief
- **Replay Validation:** Record → Export → Import → Verify identical output
- **Campaign Progression:** Start campaign → Complete mission → Check unlocks

---

## 8. File Structure

```
voidlock/
├── docs/
│   ├── spec/                 # Detailed specifications (READ-ONLY)
│   │   ├── index.md
│   │   ├── simulation.md
│   │   ├── map.md
│   │   ├── ui.md
│   │   ├── commands.md
│   │   ├── combat_units.md
│   │   ├── enemies.md
│   │   ├── ai.md
│   │   ├── items.md
│   │   ├── mission.md
│   │   └── campaign.md
│   └── adr/                  # Architectural Decision Records
│       ├── 001-gemini-to-claude-migration.md
│       └── (future ADRs)
├── src/
│   ├── engine/               # Simulation logic (Web Worker)
│   │   ├── GameEngine.ts     # Main entry point
│   │   ├── GameState.ts      # World state definition
│   │   ├── Grid.ts           # Grid data structure
│   │   ├── Pathfinder.ts     # A* pathfinding
│   │   ├── LineOfSight.ts    # LOS raycasting
│   │   ├── CombatSystem.ts   # Weapon firing, damage
│   │   ├── Director.ts       # Enemy spawning
│   │   ├── CommandProcessor.ts # Command validation/execution
│   │   ├── PRNG.ts           # Seeded random number generator
│   │   ├── tests/            # Unit tests
│   │   │   ├── Grid.test.ts
│   │   │   ├── Pathfinder.test.ts
│   │   │   └── regression_*.test.ts
│   │   └── CLAUDE.md         # Directory documentation
│   ├── ui/                   # Presentation layer
│   │   ├── CanvasRenderer.ts # Main rendering engine
│   │   ├── ScreenManager.ts  # Screen flow orchestration
│   │   ├── InputHandler.ts   # Keyboard/mouse events
│   │   ├── WorkerBridge.ts   # Worker communication
│   │   ├── components/       # Reusable UI components
│   │   │   ├── SoldierCard.ts
│   │   │   ├── CommandMenu.ts
│   │   │   └── Modal.ts
│   │   ├── screens/          # Full-screen views
│   │   │   ├── MainMenu.ts
│   │   │   ├── MissionSetup.ts
│   │   │   ├── MissionScreen.ts
│   │   │   └── Debrief.ts
│   │   └── CLAUDE.md
│   ├── content/              # Data definitions
│   │   ├── packs/
│   │   │   └── default-pack.json
│   │   ├── maps/
│   │   │   └── test-map-2x2.json
│   │   ├── ContentPackLoader.ts
│   │   ├── MapParser.ts      # ASCII → MapDefinition
│   │   └── CLAUDE.md
│   ├── shared/               # Cross-cutting utilities
│   │   ├── types/            # Shared TypeScript types
│   │   │   ├── Vector2.ts
│   │   │   ├── Command.ts
│   │   │   └── WorldState.ts
│   │   ├── constants.ts      # Global config
│   │   ├── utils.ts          # Pure helper functions
│   │   ├── protocol.ts       # Worker ↔ Main message types
│   │   └── CLAUDE.md
│   ├── main.ts               # Entry point (Main thread)
│   └── engine.worker.ts      # Entry point (Worker thread)
├── public/
│   ├── assets/               # WebP sprites, SVG icons
│   └── index.html            # HTML shell
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── ARCHITECTURE.md           # THIS FILE
├── docs/
│   ├── AGENTS.md             # Contributor guidelines (AI agents)
│   ├── MANAGER.md            # Manager agent instructions
│   └── ...
└── README.md                 # Project overview (for humans)
```

---

## 9. Key Design Principles

1. **Separation of Concerns:**
   - **Engine:** Pure simulation logic, no UI dependencies
   - **UI:** Pure presentation, no game rules
   - **Content:** Pure data, no logic

1. **Determinism First:**
   - Worker owns PRNG, no `Math.random()`
   - All state transitions driven by commands
   - Replay log captures full session history

1. **Single Source of Truth:**
   - Worker owns canonical `GameState`
   - Main thread receives read-only snapshots
   - UI never mutates state directly

1. **Performance via Isolation:**
   - Web Worker offloads heavy computation (pathfinding, LOS)
   - UI thread focuses on rendering (60 FPS)
   - Tick rate decoupled from frame rate

1. **Testability:**
   - Pure functions where possible
   - Dependency injection for mocking (PRNG, map generator)
   - Micro-maps for fast, focused tests

1. **Modularity:**
   - Content Packs enable modding without code changes
   - Map generators swappable (TreeShip, DenseShip, Static)
   - Renderer supports multiple visual styles (Tactical, Sprites)

1. **Accessibility:**
   - Fully keyboard-navigable
   - No reliance on mouse
   - Hierarchical command menu (Action → Orders → Target → Unit)

1. **Resilience:**
   - Top-level error handler (graceful degradation)
   - Emergency reset button (wipes corrupted LocalStorage)
   - Schema validation for content packs

---

## 10. References

- **Specs:** [`docs/spec/index.md`](docs/spec/index.md)
- **ADRs:** [`docs/adr/`](docs/adr/)
- **Agent Guidelines:** [`docs/AGENTS.md`](docs/AGENTS.md)
- **Manager Guidelines:** [`docs/MANAGER.md`](docs/MANAGER.md)

---

**Last Updated:** 2026-02-06
**Version:** 1.0
