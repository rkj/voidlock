import { GameState, MapDefinition, CellType, Vector2, UnitState } from '../shared/types';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private cellSize: number = 32; // Pixels per cell

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error("Could not get 2D rendering context for canvas.");
    }
    this.ctx = ctx;
  }

  public setCellSize(size: number) {
    this.cellSize = size;
  }

  public render(state: GameState) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.renderMap(state.map);
    this.renderUnits(state);
  }

  private renderMap(map: MapDefinition) {
    this.canvas.width = map.width * this.cellSize;
    this.canvas.height = map.height * this.cellSize;

    map.cells.forEach(cell => {
      this.ctx.fillStyle = cell.type === CellType.Floor ? '#333' : '#666';
      this.ctx.fillRect(
        cell.x * this.cellSize,
        cell.y * this.cellSize,
        this.cellSize,
        this.cellSize
      );
      this.ctx.strokeStyle = '#222';
      this.ctx.strokeRect(
        cell.x * this.cellSize,
        cell.y * this.cellSize,
        this.cellSize,
        this.cellSize
      );
    });
  }

  private renderUnits(state: GameState) {
    state.units.forEach(unit => {
      const x = unit.pos.x * this.cellSize + this.cellSize / 2;
      const y = unit.pos.y * this.cellSize + this.cellSize / 2;

      this.ctx.beginPath();
      this.ctx.arc(x, y, this.cellSize / 3, 0, Math.PI * 2);
      this.ctx.fillStyle = unit.state === UnitState.Moving ? '#FFD700' : '#00FF00'; // Gold for moving, green for idle
      this.ctx.fill();
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Optional: draw target position for moving units
      if (unit.state === UnitState.Moving && unit.targetPos) {
        this.ctx.beginPath();
        this.ctx.arc(unit.targetPos.x * this.cellSize + this.cellSize / 2,
                     unit.targetPos.y * this.cellSize + this.cellSize / 2,
                     this.cellSize / 4, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#FF00FF'; // Magenta target
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }
    });
  }

  public getCellCoordinates(pixelX: number, pixelY: number): Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((pixelX - rect.left) / this.cellSize);
    const y = Math.floor((pixelY - rect.top) / this.cellSize);
    return { x, y };
  }
}
