import { CellType } from '../shared/types';

export type Direction = 'n' | 'e' | 's' | 'w';

export class Boundary {
  public isWall: boolean = false;
  public doorId?: string;

  constructor(isWall: boolean, doorId?: string) {
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
    public type: CellType
  ) {}
}

export class Graph {
  public readonly cells: GraphCell[][] = [];
  public readonly boundaries: Map<string, Boundary> = new Map();

  constructor(public readonly width: number, public readonly height: number) {
    for (let y = 0; y < height; y++) {
      this.cells[y] = [];
      for (let x = 0; x < width; x++) {
        this.cells[y][x] = new GraphCell(x, y, CellType.Wall);
      }
    }
  }

  public getBoundaryKey(x1: number, y1: number, x2: number, y2: number): string {
    const p1 = `${x1},${y1}`;
    const p2 = `${x2},${y2}`;
    return [p1, p2].sort().join('--');
  }
}
