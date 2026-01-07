# World Model & Map Generation

## 3.1 The Grid (Shared Walls / Edge-Based)

The map is a grid of `Cells`, but walls are defined as **Shared Boundaries** (Edges) between cells, not as solid blocks. This "Thin Wall" architecture allows for more realistic spaceship interiors. Non-floor areas (outer space or solid rock) are represented as **Void** cells, not as solid Wall tiles.

- **Coordinate System:** `x` (Column), `y` (Row). Top-left is `0,0`.
- **Adjacency:** Orthogonal only (North, South, East, West).
- **Graph Architecture**:
  - **Cell**: Represents a floor tile or a Void (empty) tile.
  - **Boundary**: A shared object between two adjacent cells (e.g., the East edge of (0,0) is the same object as the West edge of (1,0)).
  - **State**: A Boundary can be a `Wall`, a `Door`, or `Open`. Changes to a Boundary (e.g. opening a door) instantly affect both adjacent cells.

**Cell Data Model (Logical):**

See [ADR 0001: Edge-Based Map Architecture](../docs/adr/0001-edge-based-map.md) for the authoritative `Cell` and `Boundary` data structures.

## 7) Pluggable balancing and generation interfaces

### 7.1 Content pack structure

- `pack.json` (data)
- Optional `pack.js` exporting generator/director implementations

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

**Map Generation Configuration**

The map generation subsystem must utilize a unified configuration model. Instead of passing parameters piecemeal during function calls, a comprehensive configuration object (defining seed, dimensions, strategy, and spawn counts) must be provided upon initialization.

-   **Behavior:** The generator instance is immutable regarding its configuration. To generate a map with different parameters, a new generator instance must be created.
-   **Implementation:** See [ADR 0013: Unified Map Generation Configuration](../docs/adr/0013-unified-map-generation-config.md) for the specific `MapGenerationConfig` interface and class structure.

**MapGenerator**

-   **Initialization:** Accepts the configuration object at startup.
-   **Generation:** A parameter-less execution method that produces a `MapDefinition` based on the injected configuration.
-   **Loading:** Ability to bypass generation and load a specific `MapDefinition` (for static maps or save games).
-   **Validation:**
    -   **Enforces Strict Placement Rules (Section 8.5):** Ensures all spawn points (squad and enemy) and objectives are located in rooms (not corridors) and that squad and enemy spawns occupy mutually exclusive rooms.

  - **Map Generation Strategy Selection**: The `MapGenerator` (or its client) must support selecting different generation strategies (e.g., `procedural-maze`, `static-predefined`, `custom-scripted`).

  - **Connectivity Guarantee (No "Open Walls to Nowhere"):**
    - **Concept:** "Walls" are edges between cells, never full tiles. Impassable full tiles are referred to as **Void** cells.
    - **Implementation Rule:** The generator must post-process the map using a flood-fill algorithm starting from the spawn point(s).
      - Any cell reached by flood-fill (passing only through open passages/doors) becomes a valid `Floor` cell.
      - Any cell _not_ reached by this flood-fill must be converted to `Void` (Outer Space).
    - **Goal:** This prevents the rendering artifact where a Floor cell has an open edge leading into a Void cell, effectively creating an "open passage to nowhere".

### 8.5 Entity Placement Constraints (Strict)

- **Exclusivity:** A single cell can contain at most **one** of the following static entities:
  - Squad Spawn Point
  - Enemy Spawn Point
  - Extraction Point
  - Objective Target
- **Room Exclusivity (Strict):**
  - **Major Entities:** The following entities are considered "Major" and must **NEVER** share a room with each other (in any combination):
    1. **Squad Spawn** (or Drop Point)
    2. **Enemy Spawn**
    3. **Extraction Point**
  - **Ideal Separation:** Ideally, **Objectives** (Artifacts/Intel/VIP) should also be in their own isolated rooms.
  - **Small Map Fallback:** On very small maps where room count is limited, **Objectives** MAY share a room with **Enemy Spawns** or **Extraction Points** (if absolutely necessary), but **Squad Spawns** must ALWAYS remain completely isolated (containing only the Squad Spawn).
- **Validation Strategy:**
  - This logic is validated via automated testing suites that generate a large volume of maps across various sizes (e.g., 3x3 to 10x10) to ensure compliance.
  - It is **NOT** a runtime check during normal gameplay generation to avoid performance overhead.

**TreeShipGenerator (Sector Layout) Specifics:**
The `TreeShipGenerator` produces maps with a structured layout:

- **Map Size:** Maps must not exceed 16x16 tiles.
- **Fill Rate:** Can be sparse (\<90% coverage) to create a claustrophobic, wall-heavy feel.
- **Structure:**
  - **Corridors (Depth 0):** A few long corridors traversing the map.
    - **No Internal Doors:** Corridors should be open segments. Do not place doors _inside_ the corridor length (only at ends or room entrances).
    - **Dimensions:** Strictly 1 tile wide.
  - **Rooms (Depth 1+):** Rooms connect to corridors or other rooms.
    - **Room Size:** Max 2x2.
    - **No Nested Rooms:** A 2x2 room must be fully open internally (no internal walls or doors blocking the 2x2 space). 1x1 rooms cannot be "inside" or part of a 2x2 block that isn't fully open.
  - **Depth Hierarchy & Acyclicity:** (Same as DenseShipGenerator)
    - Rooms form a strict tree structure from the corridors.
    - No cycles (acyclic graph).
    - No back-links (Depth N connects only to N-1).

**DenseShipGenerator Specifics:**
A high-density generator designed for exploration depth.

- **Fill Rate:** Must achieve >90% floor coverage (almost all cells accessible).
- **Structure - Frame & Rooms:**
  - **Corridor Frame:** The map skeleton is built from 1-tile wide corridors (1xN or Nx1).
    - **Length:** Each corridor segment must be at least 50% of the map's dimension in that direction.
    - **Spacing:** Parallel corridors must never be adjacent (no 2-tile wide corridors). There must be at least 1 tile of space between them (which will be filled by rooms).
    - **Connectivity:** Corridors can intersect (forming H, T, or + shapes) but must form a single connected component.
  - **Rooms:** Rooms are attached to the corridor frame.
    - **Strict Shapes:** Rooms must be rectangular and strictly one of these dimensions: 1x1, 1x2, 2x1, or 2x2.
    - **No Irregular Shapes:** No L-shapes, T-shapes, or non-rectangular rooms allowed.
  - **Connectivity:** Rooms connect to the corridor frame or to other rooms, maintaining the overall tree-like flow from the frame.
- **Difficulty Scaling:**
  - Easy/Small Maps: Max depth 1.
  - Hard/Large Maps: Max depth 3-4.

### 7.3 ASCII Map Representation

To facilitate easy creation and debugging of maps, especially for hardcoded or test scenarios, the system should support conversion between `MapDefinition` and a simplified ASCII string format that accurately reflects the "walls between cells" model.

- **Format**: The ASCII representation will use an expanded grid where each character position either represents a cell's content, a wall segment, or a wall corner. For a map of `width` W and `height` H, the ASCII grid will be `(2W+1)` columns wide and `(2H+1)` rows tall.
  - **Cell Content Characters (at `(2x+1, 2y+1)` positions):**
    - `' '` (space): Floor cell (passable, default interior of the ship).
    - `'#'`: Void cell (impassable, empty space or solid rock).
    - `'S'`: Floor cell with a Spawn Point
    - `'E'`: Floor cell with an Extraction Point
    - `'O'`: Floor cell with an Objective
    - _Priority_: For Floor cells: `S` > `E` > `O` > ` `. If Cell is `Void`, then `#` overrides all other content.

  - **Wall/Passage Characters:**
    - **Horizontal Wall/Passage (at `(2x+1, 2y)` positions):**
      - `'-'`: Horizontal wall segment
      - `' '` (space): Horizontal open passage (no wall)
    - **Vertical Wall/Passage (at `(2x, 2y+1)` positions):**
      - `'|'`: Vertical wall segment
      - `' '` (space): Vertical open passage (no wall)
    - **Door (replacing a wall segment):**
      - `'='`: Horizontal Door (replaces `'-'`)
      - `'I'`: Vertical Door (replaces `'|'`)
    - **Corner Characters (at `(2x, 2y)` positions):**
      - `'+'`: Default corner (intersection of walls)
      - `' '` (space): Corner with no adjacent walls (or just for visual spacing if open passages meet)

- **Conversion**:
  - `toAscii(map: MapDefinition) -> string`: Convert a `MapDefinition` object into its ASCII string representation.
  - `fromAscii(asciiMap: string) -> MapDefinition`: Parse an ASCII string representation back into a `MapDefinition` object.
  - _Note_: The `fromAscii` conversion will need sensible defaults for attributes not explicitly representable in ASCII (e.g., door HP, objective kind). It will also need to infer wall `true`/`false` based on the presence of `'-'`, `'|'`, `'='`, `'I'` characters.

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

## 15) Map Viewer App

- **Purpose**: Develop a separate, standalone web application dedicated to loading and displaying `MapDefinition` JSON.
- **Features**:
  - Load `MapDefinition` JSON (via paste or file upload).
  - Render the map accurately, including Floor/Void cells, walls, doors (with their states), spawn points, extraction, and objectives.
  - Ability to download the rendered map as a PNG or SVG file.
  - (Optional but desired) Interactive elements for zooming, panning, and toggling debug overlays (e.g., cell coordinates).
- **Utility**: This app will be crucial for debugging map definitions, creating test scenarios, and generating visual test assets.
