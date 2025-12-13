import { MapDefinition, CellType, Grid, Vector2, Cell } from '../shared/types';

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

  canMove(fromX: number, fromY: number, toX: number, toY: number): boolean {
    if (!this.isWalkable(fromX, fromY) || !this.isWalkable(toX, toY)) return false;

    // Must be adjacent
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return false; // Orthogonal only for walls check

    const fromCell = this.cells[fromY][fromX];
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