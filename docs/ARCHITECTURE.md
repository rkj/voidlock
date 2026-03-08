# Voidlock Architecture

**Last Updated:** 2026-03-08

## Overview

Voidlock is a single-player, Real-Time with Pause (RTwP) tactical squad combat game built for the web. The architecture follows a strict separation between simulation logic (deterministic, Web Worker-based) and presentation (Canvas + DOM UI).

For detailed specifications, refer to:
- [Simulation & Protocol](spec/simulation.md)
- [World Model & Map](spec/map.md)
- [User Interface](spec/ui.md)
- [Command System & AI](spec/commands.md)
- [Architecture Decision Records](adr/)

## Technology Stack

| Component       | Technology    |
|-----------------|---------------|
| Language        | TypeScript    |
| Build Tool      | Vite          |
| Module System   | ES Modules    |
| Rendering       | HTML5 Canvas + DOM |
| Concurrency     | Web Workers   |
| Storage         | LocalStorage  |
| Test Framework  | Vitest        |
| E2E Testing     | Puppeteer     |

---

## 1. Module Boundaries

### 1.1 `src/engine/` — Simulation (Web Worker)

Core game simulation: deterministic, isolated, no DOM access.

- **Game Loop:** Fixed-timestep simulation (~60Hz tick rate)
- **Game State:** Authoritative world state (units, map, objectives, fog of war)
- **Pathfinding:** BFS-based grid navigation
- **Line of Sight:** Geometric raycasting with edge-based boundaries (ADR 0026)
- **Combat System:** Weapon firing, damage resolution, accuracy calculations
- **AI Director:** Enemy spawning algorithm (pacing, threat scaling)
- **Unit AI:** Behavior composition (Safety > Interaction > Combat > Objective > Exploration) with committed plans (ADR 0056)
- **Command Processing:** Validates and executes player/AI commands
- **PRNG:** Seeded random number generator (no `Math.random()`)

**Constraints:** No DOM access, no side effects beyond state mutations, deterministic.

### 1.2 `src/renderer/` — Presentation (Main Thread)

Canvas rendering, DOM UI, input handling, screen flow.

- **Layered Canvas Renderer:** MapLayer > MapEntityLayer > UnitLayer > EffectLayer > OverlayLayer
- **Screen Manager:** Orchestrates screen transitions (Main Menu, Campaign, Mission, Debrief, Equipment, Statistics)
- **Input System:** Centralized keyboard/mouse/touch dispatcher with priority-based handling (ADR 0037)
- **Hierarchical Command Menu:** Keyboard-first tactical interface
- **UI Components:** Vanilla TSX components (ADR 0051), no framework
- **Worker Bridge:** Message passing to/from engine worker

**Constraints:** No simulation logic, no direct state mutation, vanilla TypeScript.

### 1.3 `src/content/` — Game Data

Static data definitions: content packs, maps, archetypes, tile definitions.

**Constraints:** Pure data (JSON-serializable), immutable at runtime.

### 1.4 `src/shared/` — Cross-Cutting

Types, constants, and utilities shared across engine and renderer.

- Core types: `Unit`, `MapDefinition`, `Command`, `GameState`
- Protocol definitions: Worker <-> Main message types
- PRNG implementation
- Validation schemas

**Constraints:** No dependencies on engine or renderer modules.

---

## 2. Web Worker Architecture

### 2.1 Thread Split

```
Main Thread (UI)                    Worker Thread (Engine)
├── Canvas Renderer (60 FPS)        ├── CoreEngine (game loop)
├── DOM UI (screens, HUD)           ├── All Managers
├── Input handling                  ├── Pathfinding, LOS, Combat
├── Screen flow                     ├── AI (Unit + Enemy)
└── LocalStorage                    └── PRNG (deterministic)
         │                                    │
         └────── postMessage protocol ────────┘
```

### 2.2 Message Protocol

**Main -> Worker:** INIT, COMMAND, QUERY_STATE, SET_SPEED, TOGGLE_DEBUG, RESET
**Worker -> Main:** STATE_UPDATE, MISSION_COMPLETE, ERROR, DEBUG_INFO

### 2.3 State Ownership

| State               | Owner  | Mutability          |
|----------------------|--------|---------------------|
| Game State (canonical) | Worker | Mutable (via commands) |
| UI State (snapshot)    | Main   | Read-only (replaced each tick) |
| Input State            | Main   | Mutable (local)     |
| Campaign Save          | Main   | LocalStorage        |
| Replay Log             | Worker | Append-only         |

---

## 3. Core Systems

### Manager Pattern

CoreEngine delegates to specialized managers:
```
CoreEngine
├── MissionManager       # Objectives, win/loss conditions
├── UnitManager          # Player unit lifecycle, AI behaviors
├── EnemyManager         # Enemy AI and spawning
├── DoorManager          # Door states and transitions
├── VisibilityManager    # Fog of war (LOS-based)
├── LootManager          # Item drops and collection
├── CombatManager        # Damage resolution
├── MovementManager      # Pathfinding and movement
├── CommandExecutor      # Command execution pipeline
├── StatsManager         # Mission statistics
└── CampaignManager      # Persistent campaign state
```

### Grid and Graph System

Edge-based map representation (ADR 0001): boundaries between cells are first-class objects (Wall, Open, Door). Enables thin walls, shared door state, and natural raycasting.

### AI System

**Unit AI** uses behavior composition with committed plans (ADR 0056):
```
Behaviors (priority order):
1. SafetyBehavior     — Retreat when low HP, kiting
2. InteractionBehavior — Open doors, pickup items
3. CombatBehavior     — Engage visible hostiles
4. ObjectiveBehavior  — Complete mission tasks
5. ExplorationBehavior — Explore fog of war
```

**Enemy AI** uses strategy pattern: SwarmMeleeAI, RangedKiteAI, VipAI.

### Command Pattern

All game actions are `Command` objects (MOVE_TO, OPEN_DOOR, SET_ENGAGEMENT, etc.), enabling replay recording/playback and deterministic simulation.

### Campaign System

Persistent strategic layer: soldier roster with XP/leveling, sector map (DAG), resource economy (scrap, intel), death rules, random events.

---

## 4. Render Pipeline

### Layer Stack (bottom to top)

1. **MapLayer** — Floor, walls, grid
2. **MapEntityLayer** — Doors, objectives, loot (respects FOW)
3. **UnitLayer** — Soldiers, enemies, health bars
4. **EffectLayer** — Tracers, explosions, damage numbers
5. **OverlayLayer** — Selection, targeting, debug

### Visual Modes

- **Tactical Icons** (default): Abstract geometric shapes, high contrast
- **Sprites**: WebP images with alpha channel
- **Debug**: Grid coordinates, full visibility, LOS raycasts

### Fog of War

- **Classic (Shroud)**: Undiscovered=black, Discovered=geometry only, Visible=full
- **Hardcore**: Out of LOS reverts to black

---

## 5. Determinism & Replay

A mission is fully reproducible from: PRNG seed + content pack + config + command log.

- Seeded PRNG (no `Math.random()` in engine)
- Fixed-timestep simulation (not wall clock)
- Command log captures full session history
- Replay: re-initialize with same seed/config, inject commands at recorded ticks

---

## 6. Testing Strategy

- **Unit tests:** Core algorithms (pathfinding, LOS, combat, map generation)
- **Integration tests:** Manager interactions, command flows
- **Regression tests:** Named `regression_<ticket_id>_<slug>.test.ts`
- **Property tests:** Map generators (acyclicity, connectivity)
- **E2E tests:** Full mission playthrough via Puppeteer
- All tests in `tests/` directory (mirrors `src/` structure)

---

## 7. Key Design Principles

1. **Separation of Concerns:** Engine (simulation) / Renderer (presentation) / Content (data)
2. **Determinism First:** Worker owns PRNG, all state driven by commands
3. **Single Source of Truth:** Worker owns canonical GameState
4. **Performance via Isolation:** Web Worker offloads heavy computation
5. **Testability:** Pure functions, dependency injection, micro-maps
6. **Modularity:** Content packs, swappable map generators, multiple visual styles

---

## References

- **Specs:** [docs/spec/index.md](spec/index.md)
- **ADRs:** [docs/adr/](adr/)
- **Agent Guidelines:** [AGENTS.md](AGENTS.md)
- **Manager Guidelines:** [MANAGER.md](MANAGER.md)
- **Dev Guide:** [dev_guide.md](dev_guide.md)
