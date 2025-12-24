import { CellType, MapDefinition, Direction as SharedDirection } from '../shared/types';

export type Direction = 'n' | 'e' | 's' | 'w';

export class Boundary {
  public isWall: boolean = false;
  public doorId?: string;

  constructor(isWall: boolean = false, doorId?: string) {
    this.isWall = isWall;
    this.doorId = doorId;
  }
}

export class GraphCell {
  public edges: Record<Direction, Boundary | null> = {
    n: null,
    e: null,
    s: null,
    w: null
  };

  constructor(
    public readonly x: number,
    public readonly y: number,
    public type: CellType,
    public roomId?: string
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
        this.cells[y][x] = new GraphCell(x, y, CellType.Wall);
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

    // 3. Hydrate boundaries from walls
    for (const cellDef of map.cells) {
      if (!this.isValid(cellDef.x, cellDef.y)) continue;

      const neighbors: { dir: Direction, dx: number, dy: number }[] = [
        { dir: 'n', dx: 0, dy: -1 },
        { dir: 'e', dx: 1, dy: 0 },
        { dir: 's', dx: 0, dy: 1 },
        { dir: 'w', dx: -1, dy: 0 },
      ];

      for (const { dir, dx, dy } of neighbors) {
        const nx = cellDef.x + dx;
        const ny = cellDef.y + dy;
        
        // Only process boundaries between valid cells or map edges
        // If neighbor is outside, it's a boundary to the void
        const boundary = this.getOrCreateBoundary(cellDef.x, cellDef.y, nx, ny);
        
        // If the cell definition says there is a wall in this direction, mark it
        if (cellDef.walls[dir]) {
          boundary.isWall = true;
        }

        this.cells[cellDef.y][cellDef.x].edges[dir] = boundary;
      }
    }

    // 4. Hydrate doors
    if (map.doors) {
      for (const door of map.doors) {
        if (door.segment.length === 2) {
          const c1 = door.segment[0];
          const c2 = door.segment[1];
          const boundary = this.getOrCreateBoundary(c1.x, c1.y, c2.x, c2.y);
          boundary.doorId = door.id;
          boundary.isWall = true; // Doors act as walls until opened/destroyed logic is applied in engine
        }
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
    return y >= 0 && y < this.cells.length && x >= 0 && x < (this.cells[0]?.length || 0);
  }

  private getOrCreateBoundary(x1: number, y1: number, x2: number, y2: number): Boundary {
    const key = this.getBoundaryKey(x1, y1, x2, y2);
    let boundary = this.boundaries.get(key);
    if (!boundary) {
      boundary = new Boundary();
      this.boundaries.set(key, boundary);
    }
    return boundary;
  }

  private getBoundaryKey(x1: number, y1: number, x2: number, y2: number): string {
    const p1 = `${x1},${y1}`;
    const p2 = `${x2},${y2}`;
    return [p1, p2].sort().join('--');
  }

  public getBoundary(x1: number, y1: number, x2: number, y2: number): Boundary | undefined {
    return this.boundaries.get(this.getBoundaryKey(x1, y1, x2, y2));
  }
}