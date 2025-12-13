import { MapDefinition, CellType, Grid, Vector2 } from '../shared/types';

export class GameGrid implements Grid {
  public readonly width: number;
  public readonly height: number;
  private cells: CellType[][];

  constructor(map: MapDefinition) {
    this.width = map.width;
    this.height = map.height;
    this.cells = Array(this.height).fill(null).map(() => Array(this.width).fill(CellType.Wall));

    map.cells.forEach(cell => {
      if (cell.x >= 0 && cell.x < this.width && cell.y >= 0 && cell.y < this.height) {
        this.cells[cell.y][cell.x] = cell.type;
      }
    });
  }

  isWalkable(x: number, y: number): boolean {
    return (
      x >= 0 &&
      x < this.width &&
      y >= 0 &&
      y < this.height &&
      this.cells[y][x] === CellType.Floor
    );
  }
}
