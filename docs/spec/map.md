# World Model & Map Generation

**Relevant ADRs:**

- [ADR 0001: Edge-Based Map Architecture](../docs/adr/0001-edge-based-map.md)
- [ADR 0013: Unified Map Generation Config](../docs/adr/0013-unified-map-generation-config.md)
- [ADR 0014: Map Generation Correctness](../docs/adr/0014-map-generation-correctness.md)

## 1. World Concepts

The world is a grid of cells representing the interior of a derelict spaceship.

- **Cells:** The fundamental unit of space. A cell is either **Floor** (walkable interior) or **Void** (impassable outer space).
- **Boundaries:** The edges between cells. Walls are thin boundaries, not solid blocks.
- **Connectivity:** The map is a single connected graph. All playable areas (rooms, corridors) must be reachable from at least one Squad Spawn Point. Isolated "islands" are not permitted.

## 2. Entity Placements (Spatial Rules)

- **Squad Spawn Points:** Exactly **2** 1x1 points placed across the map.
  - **Starting Zone:** Both squad spawn points MUST reside within the same map quadrant to ensure a unified safe entry zone.
  - **Capacity:** Each spawn point can accommodate multiple soldiers (up to the full squad of 4).
  - **Deployment:** During the Mission Setup, the player assigns each soldier in the squad to one of these two available points.
- **Extraction Zone:** The target area for mission completion (only required for Asset/VIP extraction).
- **Vents (SpawnPoints):** Locations used by the Director for active wave spawning.
  - **Visibility:** Vents **MUST** respect Fog of War rules.
  - They are only rendered if the cell is currently **Visible** or has been **Discovered**.
  - Once discovered, they remain visible while fogged.
- **Room vs Corridor Placement:**
  - **Rooms Only:** Static entities (Objectives, Hives, Loot) and pre-spawned enemies must only be placed in Rooms.
  - **Corridor Ban:** All static entities are strictly forbidden in corridors.
  - **Safety:** Pre-spawned enemies cannot exist in the same map quadrant as any Squad Spawn Point.
- **Ideal Separation:** Major entities (Squad Spawn, Enemy Spawn, Extraction) should ideally occupy mutually exclusive rooms.
  - **Small Map Fallback:** If room count is limited, Objectives MAY share a room with Enemy Spawns or Extraction Points, but Squad Spawns must ALWAYS remain isolated.
- **Extraction Point Visibility:**
  - The Extraction Point **MUST** respect Fog of War rules.
  - It is only rendered on the map if the cell it occupies has been **DISCOVERED** by the player.
  - Once a cell is discovered, the Extraction Point remains visible even if the cell is currently in the "fog".

## 3. Map Generation Constraints (Strict)

- **Exclusivity:** A single cell can contain at most **one** static entity (Spawn, Extraction, Objective, Hive, or Loot).
- **Room Exclusivity:** Squad Spawns, Enemy Spawns (Vents), and Extraction Points must **NEVER** share a room with each other.
- **Connectivity:** Every playable cell (Floor) must be part of a single connected component reachable from the Squad Spawn.

## 4. Specific Generators

### 4.1 TreeShipGenerator

Produces sparse, claustrophobic layouts with a structured tree topology.

- **Fill Rate:** sparse (\<90% coverage).
- **Corridors:** Strictly 1 tile wide, traversal-focused (no internal doors).
- **Rooms:** Attached to corridors; maximum size 2x2.
- **Acyclicity:** Strict tree structure; no cycles or back-links.

### 4.2 DenseShipGenerator

Designed for high-density layouts and maximum exploration depth.

- **Fill Rate:** >90% floor coverage.
- **Frame:** Built from 1-tile wide corridors (minimum 50% map dimension length).
- **Rooms:** Rectangular shapes strictly sized 1x1, 1x2, 2x1, or 2x2.
- **Connectivity:** Rooms connect to the corridor frame or other rooms in a tree-like flow.

## 5. ASCII Map Representation

To facilitate debugging, the system supports an expanded grid where each character represents a cell, wall segment, or corner. For a map of width W and height H, the ASCII grid is `(2W+1)` columns by `(2H+1)` rows.

- **Cell Content (at 2x+1, 2y+1):**
  - `' '`: Floor cell (walkable).
  - `'#'`: Void cell (impassable).
  - `'S'`: Squad Spawn Point.
  - `'E'`: Extraction Point.
  - `'O'`: Objective.
- **Wall/Passage:**
  - `'-'` / `'|'`: Horizontal/Vertical wall segment.
  - `'='` / `'I'`: Horizontal/Vertical door.
  - `' '`: Open passage (no wall).
- **Corners (at 2x, 2y):**
  - `'+'`: Wall intersection.

## 6. Content Packs & Interfaces

### 6.1 Content Pack Structure (`pack.json`)

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
  "enemyArchetypes": {...}
}
```

### 6.2 MapGenerator Interface

- **Initialization:** Accepts a `MapGenerationConfig` object (seed, dimensions, strategy, spawn counts).
- **Immutability:** A generator instance is immutable regarding its config; new parameters require a new instance.
- **Validation:** Enforces placement rules and ensures single-component connectivity ("Correct by Construction").

## 7. Map Viewer App

A standalone web utility dedicated to loading and displaying `MapDefinition` JSON.

- **Features:** JSON upload/paste, accurate rendering of all geometry and entities, PNG/SVG export, and debug overlays (coordinate grids).
