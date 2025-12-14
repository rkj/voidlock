import { MapDefinition, CellType, Grid, Vector2, Cell, Door } from '../shared/types';

export class GameGrid implements Grid {
  public readonly width: number;
  public readonly height: number;
  private cells: Cell[][];

  constructor(map: MapDefinition) {
    this.width = map.width;
    this.height = map.height;

    // Initialize with default walls (all closed if not provided)
    this.cells = Array(this.height).fill(null).map((_, y) => 
      Array(this.width).fill(null).map((_, x) => ({
        x, y, 
        type: CellType.Wall, // Default void
        walls: { n: true, e: true, s: true, w: true } 
      }))
    );

    map.cells.forEach(cell => {
      if (cell.x >= 0 && cell.x < this.width && cell.y >= 0 && cell.y < this.height) {
        this.cells[cell.y][cell.x] = cell;
      }
    });
  }

  isWalkable(x: number, y: number): boolean {
    return (
      x >= 0 &&
      x < this.width &&
      y >= 0 &&
      y < this.height &&
      this.cells[y][x].type === CellType.Floor
    );
  }

  canMove(fromX: number, fromY: number, toX: number, toY: number, doors?: Map<string, Door>): boolean {
    if (!this.isWalkable(fromX, fromY) || !this.isWalkable(toX, toY)) {
      return false;
    }

    // Must be adjacent
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (Math.abs(dx) + Math.abs(dy) !== 1) {
      return false;
    }

    const fromCell = this.cells[fromY][fromX];
    
    // Helper to get a door at a specific wall segment
    const getDoorAtSegment = (fx: number, fy: number, tx: number, ty: number): Door | undefined => {
      const sdx = tx - fx; // Segment delta x
      const sdy = ty - fy; // Segment delta y

      if (!doors) return undefined; // No doors provided

      if (Math.abs(sdx) === 1 && sdy === 0) { // Vertical segment (between columns)
        const minX = Math.min(fx, tx);
        const cellInSegment = { x: minX, y: fy }; // Cell to the left of vertical door

        for (const door of doors.values()) {
          if (door.orientation === 'Vertical' && door.segment.some(sCell => sCell.x === cellInSegment.x && sCell.y === cellInSegment.y)) {
            return door;
          }
        }
      } else if (Math.abs(sdy) === 1 && sdx === 0) { // Horizontal segment (between rows)
        const minY = Math.min(fy, ty);
        const cellInSegment = { x: fx, y: minY }; // Cell above horizontal door

        for (const door of doors.values()) {
          if (door.orientation === 'Horizontal' && door.segment.some(sCell => sCell.x === cellInSegment.x && sCell.y === cellInSegment.y)) {
            return door;
          }
        }
      }
      return undefined;
    };

    // Check for doors first
    const door = getDoorAtSegment(fromX, fromY, toX, toY);
    if (door) {
      // Allow movement if door is Open or Destroyed
      return door.state === 'Open' || door.state === 'Destroyed';
    }

    // If no door, check walls
    const toCell = this.cells[toY][toX];
    if (dx === 1) { // Moving East
      return !fromCell.walls.e && !toCell.walls.w; 
    }
    if (dx === -1) { // Moving West
      return !fromCell.walls.w && !toCell.walls.e; 
    }
    if (dy === 1) { // Moving South
      return !fromCell.walls.s && !toCell.walls.n; 
    }
    if (dy === -1) { // Moving North
      return !fromCell.walls.n && !toCell.walls.s; 
    }

    return false;
  }
}