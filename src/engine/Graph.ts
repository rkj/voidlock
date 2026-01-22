import {
  BoundaryType,
  CellType,
  MapDefinition,
  Vector2,
} from "../shared/types";

export type Direction = "n" | "e" | "s" | "w";

export class Boundary {
  public type: BoundaryType = BoundaryType.Open;
  public doorId?: string;

  constructor(
    public readonly x1: number,
    public readonly y1: number,
    public readonly x2: number,
    public readonly y2: number,
    type: BoundaryType = BoundaryType.Open,
    doorId?: string,
  ) {
    this.type = type;
    this.doorId = doorId;
  }

  public getVisualSegment(): { p1: Vector2; p2: Vector2 } {
    if (this.x1 === this.x2) {
      // Horizontal boundary (separated by y)
      const y = Math.max(this.y1, this.y2);
      const x = this.x1;
      return { p1: { x, y }, p2: { x: x + 1, y } };
    } else {
      // Vertical boundary (separated by x)
      const x = Math.max(this.x1, this.x2);
      const y = this.y1;
      return { p1: { x, y }, p2: { x, y: y + 1 } };
    }
  }
}

export class GraphCell {
  public edges: Record<Direction, Boundary | null> = {
    n: null,
    e: null,
    s: null,
    w: null,
  };

  constructor(
    public readonly x: number,
    public readonly y: number,
    public type: CellType,
    public roomId?: string,
  ) {}
}

export class Graph {
  public readonly cells: GraphCell[][] = [];
  private readonly boundaries: Map<string, Boundary> = new Map();

  constructor(map: MapDefinition) {
    const { width, height } = map;

    // 1. Initialize cells
    for (let y = 0; y < height; y++) {
      this.cells[y] = [];
      for (let x = 0; x < width; x++) {
        this.cells[y][x] = new GraphCell(x, y, CellType.Void);
      }
    }

    // 2. Hydrate cell metadata
    for (const cellDef of map.cells) {
      if (this.isValid(cellDef.x, cellDef.y)) {
        const cell = this.cells[cellDef.y][cellDef.x];
        cell.type = cellDef.type;
        cell.roomId = cellDef.roomId;
      }
    }

    // 3. Hydrate boundaries from cells (initialize all edges)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const neighbors: { dir: Direction; dx: number; dy: number }[] = [
          { dir: "n", dx: 0, dy: -1 },
          { dir: "e", dx: 1, dy: 0 },
          { dir: "s", dx: 0, dy: 1 },
          { dir: "w", dx: -1, dy: 0 },
        ];

        for (const { dir, dx, dy } of neighbors) {
          const nx = x + dx;
          const ny = y + dy;

          // Ensure boundary object exists for this edge
          const boundary = this.getOrCreateBoundary(x, y, nx, ny);
          this.cells[y][x].edges[dir] = boundary;

          // If neighbor is outside map bounds, it's a boundary to the void (default to wall)
          if (!this.isValid(nx, ny)) {
            boundary.type = BoundaryType.Wall;
          }
        }
      }
    }

    // 4. Hydrate walls from MapDefinition
    if (map.walls) {
      for (const wall of map.walls) {
        let x1: number, y1: number, x2: number, y2: number;
        if (wall.p1.x === wall.p2.x) {
          // Vertical wall segment from corner (x, y) to (x, y+1)
          // Separates cell (x-1, y) and (x, y)
          const x = wall.p1.x;
          const minY = Math.min(wall.p1.y, wall.p2.y);
          x1 = x - 1;
          y1 = minY;
          x2 = x;
          y2 = minY;
        } else {
          // Horizontal wall segment from corner (x, y) to (x+1, y)
          // Separates cell (x, y-1) and (x, y)
          const y = wall.p1.y;
          const minX = Math.min(wall.p1.x, wall.p2.x);
          x1 = minX;
          y1 = y - 1;
          x2 = minX;
          y2 = y;
        }
        const boundary = this.getOrCreateBoundary(x1, y1, x2, y2);
        boundary.type = BoundaryType.Wall;
      }
    }

    // 5. Hydrate doors
    if (map.doors) {
      for (const door of map.doors) {
        if (door.segment.length === 2) {
          const c1 = door.segment[0];
          const c2 = door.segment[1];
          const boundary = this.getOrCreateBoundary(c1.x, c1.y, c2.x, c2.y);
          boundary.doorId = door.id;
          boundary.type = BoundaryType.Door; // Doors act as walls until opened/destroyed logic is applied in engine
        }
      }
    }

    // 6. Hydrate from boundaries array if present (authoritative)
    if (map.boundaries) {
      for (const bDef of map.boundaries) {
        const boundary = this.getOrCreateBoundary(
          bDef.x1,
          bDef.y1,
          bDef.x2,
          bDef.y2,
        );
        boundary.type = bDef.type;
        if (bDef.doorId) boundary.doorId = bDef.doorId;
      }
    }
  }

  public get width(): number {
    return this.cells[0]?.length || 0;
  }

  public get height(): number {
    return this.cells.length;
  }

  private isValid(x: number, y: number): boolean {
    return (
      y >= 0 &&
      y < this.cells.length &&
      x >= 0 &&
      x < (this.cells[0]?.length || 0)
    );
  }

  private getOrCreateBoundary(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): Boundary {
    const key = this.getBoundaryKey(x1, y1, x2, y2);
    let boundary = this.boundaries.get(key);
    if (!boundary) {
      boundary = new Boundary(x1, y1, x2, y2);
      this.boundaries.set(key, boundary);
    }
    return boundary;
  }

  private getBoundaryKey(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): string {
    const p1 = `${x1},${y1}`;
    const p2 = `${x2},${y2}`;
    return [p1, p2].sort().join("--");
  }

  public getBoundary(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): Boundary | undefined {
    return this.boundaries.get(this.getBoundaryKey(x1, y1, x2, y2));
  }

  public getAllBoundaries(): Boundary[] {
    return Array.from(this.boundaries.values());
  }
}
