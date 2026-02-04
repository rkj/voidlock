# Voidlock - Architecture Overview

**Version:** 0.106.17
**Date:** January 2026
**Document Type:** Technical Architecture

## Table of Contents

1. [Executive Summary](#executive-summary)
1. [Project Overview](#project-overview)
1. [Technology Stack](#technology-stack)
1. [Architecture Pattern](#architecture-pattern)
1. [Directory Structure](#directory-structure)
1. [Core Systems](#core-systems)
1. [Data Flow](#data-flow)
1. [State Management](#state-management)
1. [Build & Configuration](#build--configuration)
1. [Testing Strategy](#testing-strategy)

______________________________________________________________________

## Executive Summary

**Voidlock** is a deterministic Real-Time with Pause (RTwP) tactical squad combat game built with TypeScript and HTML5 Canvas. The architecture employs a worker-based client-server pattern to ensure deterministic simulation, enabling perfect replays and responsive UI.

**Key Metrics:**

- **Lines of Code:** ~20,759 TypeScript
- **Files:** 559
- **Test Coverage:** 276 test files
- **Architecture Decisions:** 28 documented ADRs

**Core Architectural Strengths:**

- Deterministic simulation via Web Worker isolation
- Edge-based map representation for efficient spatial queries
- Manager pattern for clean domain separation
- Layer-based rendering for visual organization
- Command pattern for replay support

______________________________________________________________________

## Project Overview

### Purpose

Voidlock is a single-player tactical combat game where players control a squad of soldiers navigating procedurally generated spaceship environments, fighting alien threats, and completing mission objectives.

### Key Features

- **Campaign Mode:** Persistent soldier progression and resource management
- **Procedural Generation:** Tree-based and dense graph algorithms for varied layouts
- **Deterministic Simulation:** Perfect replay capability
- **Fog of War:** Limited visibility creating tactical tension
- **Mission Types:** Extraction, artifact recovery, VIP escort, hive destruction
- **Autonomous AI:** Unit behaviors for movement, combat, and exploration

### Game Loop

```
Main Menu → Campaign Setup → Mission Briefing → Tactical Combat →
Debrief → Barracks/Equipment/Statistics → Next Mission → ... → Victory/Defeat
```

______________________________________________________________________

## Technology Stack

### Core Technologies

| Component | Technology | Version |
| ------------- | ------------ | ---------- |
| Language | TypeScript | 5.9.3 |
| Build Tool | Vite | 7.2.4 |
| Module System | ES Modules | ES2022 |
| Rendering | HTML5 Canvas | 2D Context |
| Concurrency | Web Workers | Native |
| Storage | LocalStorage | Native |

### Development Dependencies

| Purpose | Technology | Version |
| ---------------- | ---------- | ------- |
| Test Framework | Vitest | 3.2.4 |
| E2E Testing | Puppeteer | 24.1.1 |
| Test Environment | jsdom | 27.0.1 |
| Asset Processing | Sharp | 0.33.5 |

### Build Configuration

```typescript
// vite.config.ts
{
  root: 'src/',
  base: '/voidlock/',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@src': './src'
    }
  }
}
```

______________________________________________________________________

## Architecture Pattern

### Primary Pattern: Worker-Based Client-Server

Voidlock implements a strict separation between simulation (Worker thread) and presentation (Main thread):

```
┌─────────────────────────┐           ┌─────────────────────────┐
│   Main Thread (Client)  │           │   Web Worker (Server)   │
├─────────────────────────┤           ├─────────────────────────┤
│  • GameApp              │◄─────────►│  • CoreEngine           │
│  • GameRenderer         │  Messages │  • Simulation Logic     │
│  • InputManager         │           │  • Game State           │
│  • ScreenManager        │           │  • All Managers         │
│  • UI Components        │           │  • Pathfinding          │
└─────────────────────────┘           └─────────────────────────┘
```

#### Benefits

1. **Deterministic Execution:** Worker isolation prevents timing issues
1. **Responsive UI:** Heavy computation doesn't block rendering
1. **Perfect Replays:** Command log + seed = reproducible outcomes
1. **Clean Separation:** Presentation logic cannot affect simulation

### Secondary Patterns

#### Manager Pattern (Domain-Driven Design)

The `CoreEngine` delegates responsibilities to specialized managers:

```
CoreEngine
├── MissionManager      # Mission objectives and win/loss conditions
├── UnitManager         # Player unit lifecycle and behaviors
├── EnemyManager        # Enemy AI and combat
├── DoorManager         # Door states and transitions
├── VisibilityManager   # Fog of war calculations
├── LootManager         # Item drops and collection
├── CombatManager       # Damage resolution
├── MovementManager     # Pathfinding and movement
├── CommandExecutor     # Command execution
└── CampaignManager     # Persistent campaign state
```

#### Strategy Pattern (AI System)

```typescript
interface IEnemyAI {
  think(enemy, state, grid, pathfinder, los, prng): void;
}

// Implementations:
-SwarmMeleeAI - // Charge nearest soldier
  RangedKiteAI - // Maintain distance while firing
  VipAI; // Non-combatant movement
```

Unit AI uses **behavior composition**:

```typescript
behaviors = [
  SafetyBehavior, // Retreat when low HP
  CombatBehavior, // Opportunistic fire
  ObjectiveBehavior, // Complete mission tasks
  InteractionBehavior, // Open doors, pickup items
  ExplorationBehavior, // Explore fog of war
];
```

#### Command Pattern

All game actions are represented as `Command` objects:

```typescript
type Command =
  | { type: CommandType.MOVE_TO; unitId: string; destination: Vector2 }
  | { type: CommandType.OPEN_DOOR; unitId: string; doorId: string }
  | { type: CommandType.SET_ENGAGEMENT; unitId: string; policy: string }
  | { type: CommandType.PICKUP_LOOT; unitId: string; lootId: string };
// ...
```

This enables:

- Replay recording/playback
- Network synchronization (future)
- Undo/redo capabilities (future)

#### Layer Pattern (Rendering)

The renderer uses a **layered rendering architecture**:

```
┌──────────────────────┐  Top (UI overlays)
│   OverlayLayer       │  Selection, targeting
├──────────────────────┤
│   EffectLayer        │  Tracers, explosions
├──────────────────────┤
│   UnitLayer          │  Units, enemies, health bars
├──────────────────────┤
│   MapEntityLayer     │  Doors, objectives, loot
├──────────────────────┤
│   MapLayer           │  Grid, walls, floor
└──────────────────────┘  Bottom (static background)
```

Each layer:

- Extends `RenderLayer` interface
- Receives immutable `GameState`
- Draws independently without side effects
- Can be toggled for debugging

______________________________________________________________________

## Directory Structure

```
/home/user/voidlock/
├── src/                          # Source code root (Vite entry)
│   ├── engine/                   # Core simulation (Worker thread)
│   │   ├── ai/                   # AI strategies and behaviors
│   │   │   ├── behaviors/        # Modular behavior components
│   │   │   ├── EnemyAI.ts        # Enemy AI implementations
│   │   │   ├── RangedKiteAI.ts   # Ranged enemy behavior
│   │   │   └── VipAI.ts          # VIP escort AI
│   │   ├── campaign/             # Campaign strategic layer
│   │   │   ├── EventManager.ts   # Random events
│   │   │   ├── RosterManager.ts  # Soldier roster management
│   │   │   └── MissionReconciler.ts
│   │   ├── generators/           # Map generation algorithms
│   │   │   ├── TreeShipGenerator.ts    # Acyclic tree layouts
│   │   │   ├── SpaceshipGenerator.ts   # Dense interconnected maps
│   │   │   ├── DenseShipGenerator.ts
│   │   │   ├── SectorMapGenerator.ts   # Campaign progression DAG
│   │   │   └── PlacementValidator.ts
│   │   ├── managers/             # Domain-specific logic handlers
│   │   │   ├── CampaignManager.ts
│   │   │   ├── MissionManager.ts
│   │   │   ├── UnitManager.ts
│   │   │   ├── EnemyManager.ts
│   │   │   ├── DoorManager.ts
│   │   │   ├── VisibilityManager.ts
│   │   │   ├── CombatManager.ts
│   │   │   ├── MovementManager.ts
│   │   │   ├── CommandExecutor.ts
│   │   │   ├── CommandHandler.ts
│   │   │   ├── LootManager.ts
│   │   │   ├── StatsManager.ts
│   │   │   └── MetaManager.ts
│   │   ├── map/                  # Map processing pipeline
│   │   │   ├── MapFactory.ts     # Generation orchestrator
│   │   │   ├── MapValidator.ts   # Correctness checks
│   │   │   └── MapSanitizer.ts   # Post-processing cleanup
│   │   ├── persistence/          # Storage abstraction
│   │   │   ├── StorageProvider.ts
│   │   │   ├── LocalStorageProvider.ts
│   │   │   └── MockStorageProvider.ts
│   │   ├── tests/                # Engine unit tests
│   │   ├── CoreEngine.ts         # Main simulation controller
│   │   ├── GameClient.ts         # Main thread bridge to worker
│   │   ├── GameGrid.ts           # Grid + boundary graph
│   │   ├── Graph.ts              # Cell/boundary graph structure
│   │   ├── Pathfinder.ts         # A* pathfinding
│   │   ├── LineOfSight.ts        # Raycasting visibility
│   │   ├── Director.ts           # Enemy wave spawning
│   │   └── worker.ts             # Web Worker entry point
│   ├── renderer/                 # Main thread UI and rendering
│   │   ├── app/                  # Application lifecycle
│   │   │   ├── GameApp.ts        # Main application controller
│   │   │   ├── AppContext.ts     # Shared context object
│   │   │   └── InputBinder.ts    # Keyboard bindings
│   │   ├── campaign/             # Campaign UI layer
│   │   ├── components/           # Reusable UI components
│   │   ├── controllers/          # Input and command handling
│   │   │   ├── CommandBuilder.ts
│   │   │   ├── SelectionManager.ts
│   │   │   ├── RoomDiscoveryManager.ts
│   │   │   └── MenuStateMachine.ts
│   │   ├── screens/              # Screen implementations
│   │   │   ├── BarracksScreen.ts
│   │   │   ├── CampaignScreen.ts
│   │   │   ├── DebriefScreen.ts
│   │   │   └── StatisticsScreen.ts
│   │   ├── ui/                   # UI component library
│   │   │   ├── HUDManager.ts
│   │   │   ├── MenuRenderer.ts
│   │   │   ├── ModalService.ts
│   │   │   └── SoldierInspector.ts
│   │   ├── visuals/              # Canvas rendering layers
│   │   │   ├── GameRenderer.ts   # Main renderer
│   │   │   ├── MapLayer.ts
│   │   │   ├── UnitLayer.ts
│   │   │   └── EffectLayer.ts
│   │   └── main.ts               # Main thread entry point
│   ├── shared/                   # Shared types and utilities
│   │   ├── types/                # Modular type definitions
│   │   │   ├── geometry.ts       # Vector2, Rect
│   │   │   ├── gamestate.ts      # GameState, Commands
│   │   │   ├── items.ts          # Item definitions
│   │   │   ├── map.ts            # MapDefinition, Grid
│   │   │   └── units.ts          # Unit, Enemy, Archetype
│   │   ├── types.ts              # Re-export all types
│   │   ├── campaign_types.ts     # Campaign-specific types
│   │   └── PRNG.ts               # Deterministic RNG (LCG)
│   ├── content/                  # Game content/data
│   ├── styles/                   # CSS styling
│   └── index.html                # Main HTML entry point
├── tests/                        # Test suite
│   ├── e2e/                      # End-to-end tests
│   ├── engine/                   # Engine unit tests
│   ├── renderer/                 # Renderer tests
│   └── shared/                   # Shared utility tests
├── public/                       # Static assets
│   └── assets/                   # Processed game assets
├── scripts/                      # Build/automation scripts
│   └── process_assets.ts         # Asset processing pipeline
├── spec/                         # Design documentation
│   ├── core_mechanics.md         # Current mechanics
│   ├── backlog.md                # Future features
│   └── dev_guide.md
├── docs/                         # Architecture documentation
│   └── adr/                      # Architecture Decision Records
└── conductor/                    # AI agent configuration
```

______________________________________________________________________

## Core Systems

### 1. Simulation Engine (`CoreEngine.ts`)

The authoritative game state controller running in a Web Worker.

**Responsibilities:**

- Maintains canonical `GameState`
- Processes commands from main thread
- Advances simulation at fixed 16ms tick rate (~60 FPS)
- Orchestrates manager updates
- Handles replay recording

**Update Loop Order:**

1. Director update (enemy spawning)
1. Environmental logic (door timers)
1. Visibility recalculation
1. Unit AI and behaviors
1. Enemy AI
1. Movement resolution
1. Combat resolution
1. Mission objective evaluation

**File:** `src/engine/CoreEngine.ts:552` (552 lines)

### 2. Grid and Graph System (`GameGrid.ts`, `Graph.ts`)

**Revolutionary edge-based map representation** (see ADR-0001).

Instead of cells having wall properties, the **boundaries between cells** are first-class objects:

```typescript
class Cell {
  x: number, y: number
  type: CellType
  edges: {
    N: Boundary,  // Shared with cell above
    S: Boundary,  // Shared with cell below
    E: Boundary,  // Shared with cell right
    W: Boundary   // Shared with cell left
  }
}

class Boundary {
  type: BoundaryType  // Wall, Open, Door
  doorId?: string     // If this is a door boundary
  x1, y1, x2, y2      // Endpoints for rendering
}
```

**Benefits:**

- Door state automatically consistent on both sides
- Walls are thin (edge-based) not thick (cell-based)
- Raycasting naturally handles partial occlusion
- No duplicate door objects

**Files:**

- `src/engine/GameGrid.ts`
- `src/engine/Graph.ts`

### 3. Pathfinding System (`Pathfinder.ts`)

Breadth-First Search (BFS) pathfinding on the grid graph.

**Features:**

- Plans through closed doors (units can open them)
- Respects door states (locked doors block)
- Returns cell-centered waypoints
- O(n) worst-case for grid size n

**File:** `src/engine/Pathfinder.ts`

### 4. Line of Sight System (`LineOfSight.ts`)

Raycasting-based visibility using edge boundaries.

**Algorithms:**

- **Multi-ray sampling:** Casts multiple rays between entity bounds
- **Fractional door occlusion:** Door struts (outer 1/3) block LOS
- **Circle visibility query:** Returns all visible cells within radius

**Two modes:**

- `hasLineOfSight()` - At least one ray succeeds (detection)
- `hasLineOfFire()` - All rays succeed (shooting)

**File:** `src/engine/LineOfSight.ts`

### 5. AI System

**Enemy AI** (`ai/EnemyAI.ts`):

- `SwarmMeleeAI` - Detects and charges nearest soldier
- `RangedKiteAI` - Maintains distance while firing
- `VipAI` - Non-combatant movement

**Unit AI** (`managers/UnitAI.ts`):
Autonomous behaviors using modular components:

```typescript
behaviors = [
  SafetyBehavior, // Retreat when low HP
  CombatBehavior, // Opportunistic fire
  ObjectiveBehavior, // Complete mission objectives
  InteractionBehavior, // Open doors, pickup items
  ExplorationBehavior, // Explore fog of war
];
```

Each unit evaluates behaviors in priority order (see ADR-0006).

**Files:**

- `src/engine/ai/EnemyAI.ts`
- `src/engine/ai/behaviors/*.ts`

### 6. Director System (`Director.ts`)

Dynamic enemy spawning based on **threat level**.

**Mechanics:**

- Threat increases 10% every 10 seconds
- Each 10% threshold triggers a wave spawn
- Wave size scales with campaign progression
- Spawn location is random from available spawn points
- Pre-spawns enemies if starting threat > 10%

**File:** `src/engine/Director.ts`

### 7. Campaign System (`managers/CampaignManager.ts`)

Persistent strategic layer management.

**Features:**

- Soldier roster with XP/leveling
- Death rules (Iron/Clone/Simulation)
- Sector map as a Directed Acyclic Graph (DAG)
- Resource economy (scrap, intel)
- Random events between missions
- Save/load via `StorageProvider` abstraction

**Campaign Progression:**

```
Start → Combat → Elite → Shop → Boss → Victory
          ↓       ↓       ↓       ↓
        Events  Events  Events  Events
```

**File:** `src/engine/managers/CampaignManager.ts:524` (524 lines)

### 8. Rendering System (`visuals/GameRenderer.ts`)

Layer-based Canvas rendering with no game logic.

**Layer Stack (bottom to top):**

1. **MapLayer** - Grid lines, floor, walls
1. **MapEntityLayer** - Doors, objectives, loot
1. **UnitLayer** - Units, enemies, health bars
1. **EffectLayer** - Tracers, explosions, damage numbers
1. **OverlayLayer** - Selection highlights, targeting reticles

**State Management:**

- Renderer receives immutable `GameState` snapshots
- No direct game logic in renderer
- Uses `SharedRendererState` for layer coordination

**File:** `src/renderer/visuals/GameRenderer.ts`

### 9. Theme System (`ThemeManager.ts`)

**Unified theming** across DOM and Canvas (see ADR-0012).

**Features:**

- CSS variables define colors
- `ThemeManager.getColor()` resolves variables for Canvas
- Asset manifest (`assets.json`) maps logical names to URLs
- Dynamic theme switching support

**File:** `src/renderer/ThemeManager.ts`

### 10. Input and Command System

**Controller pattern** decouples UI from game logic (see ADR-0017).

```
User Input → InputManager → MenuController → GameClient → Worker
                ↓
         SelectionManager
         CommandBuilder
         RoomDiscoveryManager
```

**Flow:**

1. User clicks/keys → `InputManager`
1. `InputManager` updates `SelectionManager`
1. `MenuController` builds `Command` objects
1. `GameClient` sends to worker via `postMessage`
1. Worker executes command in next tick

**Files:**

- `src/renderer/InputManager.ts`
- `src/renderer/MenuController.ts`
- `src/renderer/controllers/CommandBuilder.ts`

______________________________________________________________________

## Data Flow

### Mission Lifecycle

```
1. USER INITIATES MISSION
   ↓
GameApp.startMission()
   ↓
GameClient.init({ seed, map, squadConfig, missionType })
   ↓
[Main Thread] → postMessage → [Worker Thread]
   ↓
worker.ts receives 'INIT' message
   ↓
Creates CoreEngine(seed, map, squadConfig)
   ↓
CoreEngine initializes all managers and GameState
   ↓
Starts 16ms interval loop

2. SIMULATION LOOP (in Worker)
   ↓
Every 16ms:
  CoreEngine.update(16ms)
    ↓
    Updates all managers in sequence
    ↓
  state = CoreEngine.getState()
    ↓
  postMessage(STATE_UPDATE, state)
    ↓
[Worker] → [Main Thread]

3. MAIN THREAD RECEIVES STATE
   ↓
GameClient.worker.onmessage(STATE_UPDATE)
   ↓
Calls: onStateUpdateCb(state)
   ↓
GameApp.updateUI(state)
   ↓
Renderer.render(state)
   ↓
All layers draw to canvas

4. USER INPUT (Command Flow)
   ↓
User clicks canvas → InputManager
   ↓
MenuController builds Command
   ↓
GameClient.sendCommand(command)
   ↓
[Main] → postMessage('COMMAND') → [Worker]
   ↓
CoreEngine.applyCommand(command)
   ↓
Updates GameState
   ↓
Next tick: CommandExecutor executes command
   ↓
State propagates back (step 2-3)

5. MISSION END
   ↓
MissionManager detects win/loss
   ↓
state.status = 'Won' or 'Lost'
   ↓
Worker stops interval loop
   ↓
GameApp shows DebriefScreen
   ↓
CampaignManager.reconcileMission()
   ↓
Updates roster, awards resources, saves state
```

### Data Serialization

**Worker → Main:**

- `GameState` serialized via `structuredClone` (implicit in postMessage)
- Command log accumulated for replay

**Main → Worker:**

- Commands are plain objects (JSON-serializable)
- `MapDefinition` passed once at init

**Persistence:**

```
CampaignState → JSON.stringify() → LocalStorage['voidlock_campaign_v1']
                                 ↓
                              On load:
                              ↓
                        JSON.parse() → CampaignState
```

______________________________________________________________________

## State Management

### Worker Thread (Authoritative)

**Single source of truth:** `CoreEngine.state: GameState`

```typescript
type GameState = {
  t: number; // Simulation time (ms)
  seed: number; // PRNG seed
  map: MapDefinition; // Static map data
  units: Unit[]; // Player soldiers
  enemies: Enemy[]; // Hostile entities
  loot: LootItem[]; // Collectible items
  visibleCells: string[]; // FOW visible cells
  discoveredCells: string[]; // FOW discovered cells
  objectives: Objective[]; // Mission objectives
  stats: MissionStats; // Kill count, scrap, etc.
  status: GameStatus; // Playing/Won/Lost
  settings: SimulationSettings; // Debug flags, time scale
  squadInventory: { [id: string]: number };
  commandLog?: CommandLogEntry[];
};
```

**State Mutation Rules:**

1. Only mutated via `CoreEngine.update()` or `applyCommand()`
1. Managers receive mutable state reference
1. State is cloned before sending to main thread
1. **Deterministic:** Same seed + commands = Same state

### Main Thread (View/Presentation)

**Reactive:** Receives immutable state snapshots every 16ms.

**UI State (not in GameState):**

- Selected units
- Camera position/zoom
- Menu open/closed
- Modal dialogs
- Hover effects
- Animation timers

### Persistent State (LocalStorage)

**Campaign State:**

```typescript
type CampaignState = {
  version: string;
  seed: number;
  status: "Active" | "Victory" | "Defeat";
  rules: GameRules;
  scrap: number;
  intel: number;
  currentSector: number;
  currentNodeId: string | null;
  nodes: CampaignNode[];
  roster: CampaignSoldier[];
  history: MissionReport[];
  unlockedArchetypes: string[];
};
```

**Storage Keys:**

- `voidlock_campaign_v1` - Campaign save
- `voidlock_config` - User settings
- `voidlock_meta` - Global statistics
- `voidlock_mission_tick` - Crash recovery

### Determinism Guarantees

1. **Fixed timestep:** 16ms per tick (not wall clock)
1. **Seeded PRNG:** All randomness uses `PRNG(seed)`
1. **Command ordering:** Commands applied in sequence
1. **No external state:** No `Date.now()`, `Math.random()`, network I/O

**Replay System:**

```typescript
type ReplayData = {
  seed: number;
  map: MapDefinition;
  squadConfig: SquadConfig;
  commands: RecordedCommand[]; // { t: number, cmd: Command }[]
};
```

Replaying:

1. Initialize `CoreEngine` with same seed/map/squad
1. Inject commands at recorded tick times
1. Result: Identical state sequence

______________________________________________________________________

## Build & Configuration

### Development Workflow

```bash
npm run dev              # Vite dev server (localhost:5173)
                        # Hot Module Replacement enabled
                        # Source maps enabled
                        # Worker bundling automatic

npm run build           # TypeScript compile + Vite bundle
                        # Minification enabled
                        # Output to dist/

npm run test            # Vitest unit tests
npm run test:e2e        # Puppeteer E2E tests
npm run lint            # TypeScript type check

npm run process-assets  # Process raw assets to web format
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@src/*": ["src/*"]
    }
  }
}
```

### Asset Pipeline

**Process Assets Script** (`scripts/process_assets.ts`):

```
Raw Assets (NanoBanana Assets/)
          ↓
    Sharp Processing
    (resize, optimize, convert)
          ↓
  Web-Ready Assets (public/assets/)
          ↓
   Asset Manifest (assets.json)
```

**Manifest Format:**

```json
{
  "soldier_assault": "assets/units/soldier_assault.png",
  "alien_melee": "assets/enemies/alien_melee.webp",
  "door_closed": "assets/props/door_closed.png"
}
```

______________________________________________________________________

## Testing Strategy

### Test Coverage

- **276 test files** across unit, integration, and E2E tests
- **Unit tests:** Core algorithms (pathfinding, LOS, map generation)
- **Integration tests:** Manager interactions
- **Property tests:** Map generators (acyclicity, connectivity)
- **E2E tests:** Full mission playthrough
- **Snapshot tests:** Visual regression for maps

### Test Configuration

**Unit Tests** (`vitest.config.ts`):

```typescript
{
  test: {
    environment: 'jsdom',
    globals: true
  }
}
```

**E2E Tests** (`vitest.config.e2e.ts`):

```typescript
{
  test: {
    environment: 'node',
    testMatch: ['**/e2e/**/*.test.ts']
  }
}
```

### Code Quality

**Linting:**

- Strict TypeScript mode enabled
- No implicit any
- Strict null checks
- Comprehensive type coverage

**Architecture Decision Records:**

- 28 documented decisions in `docs/adr/`
- Key ADRs:
  - ADR-0001: Edge-based map representation
  - ADR-0003: Campaign system architecture
  - ADR-0006: Autonomous agent architecture
  - ADR-0008: Renderer/UI separation
  - ADR-0012: Theming system

______________________________________________________________________

## Summary

Voidlock demonstrates **professional software engineering practices**:

**Architectural Strengths:**

- ✅ Deterministic simulation enables perfect replays
- ✅ Worker thread ensures responsive UI
- ✅ Edge-based map representation is elegant and efficient
- ✅ Manager pattern keeps domain logic organized
- ✅ Layer-based renderer is composable and maintainable
- ✅ Campaign system provides meaningful progression

**Technical Metrics:**

- ~20,759 lines of TypeScript
- 559 files organized by domain
- 276 test files
- 28 architecture decision records

**Key Technologies:**

- TypeScript 5.9.3 (strict mode)
- Vite 7.2.4 (build + dev server)
- Vitest 3.2.4 (testing)
- HTML5 Canvas (rendering)
- Web Workers (concurrency)

This is a **production-quality codebase** with clear architectural vision, strong testing discipline, and excellent separation of concerns.

______________________________________________________________________

## Related Documentation

- **Design Specs:** `spec/core_mechanics.md`
- **ADRs:** `docs/adr/`
- **Code Review:** `docs/CODE_REVIEW.md`
- **Dev Guide:** `spec/dev_guide.md`
