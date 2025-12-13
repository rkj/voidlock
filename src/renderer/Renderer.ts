import { GameState, MapDefinition, CellType, Vector2, UnitState, Enemy } from '../shared/types';

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

    this.renderMap(state);
    this.renderObjectives(state);
    this.renderUnits(state);
    this.renderEnemies(state);
    this.renderFog(state);
  }

  private renderMap(state: GameState) {
    const map = state.map;
    this.canvas.width = map.width * this.cellSize;
    this.canvas.height = map.height * this.cellSize;

    map.cells.forEach(cell => {
      // Draw everything first, then apply fog
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

  private renderObjectives(state: GameState) {
    if (state.map.extraction) {
      const ext = state.map.extraction;
      this.ctx.fillStyle = '#00AAAA'; // Cyan extraction
      this.ctx.globalAlpha = 0.5;
      this.ctx.fillRect(
        ext.x * this.cellSize,
        ext.y * this.cellSize,
        this.cellSize,
        this.cellSize
      );
      this.ctx.globalAlpha = 1.0;
    }

    state.objectives?.forEach(obj => {
      if (obj.state === 'Pending' && obj.targetCell) {
        this.ctx.fillStyle = '#FFAA00'; // Orange objective
        this.ctx.globalAlpha = 0.5;
        this.ctx.fillRect(
          obj.targetCell.x * this.cellSize,
          obj.targetCell.y * this.cellSize,
          this.cellSize,
          this.cellSize
        );
        this.ctx.globalAlpha = 1.0;
      }
    });
  }

  private renderUnits(state: GameState) {
    state.units.forEach(unit => {
      if (unit.state === UnitState.Extracted || unit.state === UnitState.Dead) return;

      const x = unit.pos.x * this.cellSize; // pos is float (center-based), so this is pixel center
      const y = unit.pos.y * this.cellSize;

      this.ctx.beginPath();
      this.ctx.arc(x, y, this.cellSize / 3, 0, Math.PI * 2);
      
      if (unit.state === UnitState.Attacking) {
        this.ctx.fillStyle = '#FF4400'; // Red/Orange for attacking
      } else if (unit.state === UnitState.Moving) {
        this.ctx.fillStyle = '#FFD700'; // Gold
      } else {
        this.ctx.fillStyle = '#00FF00'; // Green
      }
      
      this.ctx.fill();
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // HP Bar
      this.renderHealthBar(x, y, unit.hp, unit.maxHp);

      // Target line
      if (unit.state === UnitState.Moving && unit.targetPos) {
        this.ctx.beginPath();
        this.ctx.arc(unit.targetPos.x * this.cellSize,
                     unit.targetPos.y * this.cellSize,
                     this.cellSize / 4, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#FF00FF'; 
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }
    });
  }

  private renderEnemies(state: GameState) {
    state.enemies.forEach(enemy => {
      if (enemy.hp <= 0) return;

      // Only render if visible
      const cellKey = `${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`;
      if (!state.visibleCells.includes(cellKey)) return;

      const x = enemy.pos.x * this.cellSize;
      const y = enemy.pos.y * this.cellSize;

      this.ctx.beginPath();
      this.ctx.moveTo(x, y - this.cellSize/3);
      this.ctx.lineTo(x + this.cellSize/3, y + this.cellSize/3);
      this.ctx.lineTo(x - this.cellSize/3, y + this.cellSize/3);
      this.ctx.closePath();
      
      this.ctx.fillStyle = '#FF0000'; // Red enemy
      this.ctx.fill();
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.renderHealthBar(x, y, enemy.hp, enemy.maxHp);
    });
  }

  private renderHealthBar(x: number, y: number, hp: number, maxHp: number) {
    const barWidth = this.cellSize * 0.8;
    const barHeight = 4;
    const yOffset = -this.cellSize / 2 - 6;

    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(x - barWidth/2, y + yOffset, barWidth, barHeight);
    
    const pct = Math.max(0, hp / maxHp);
    this.ctx.fillStyle = pct > 0.5 ? '#0f0' : pct > 0.25 ? '#ff0' : '#f00';
    this.ctx.fillRect(x - barWidth/2, y + yOffset, barWidth * pct, barHeight);
  }

  private renderFog(state: GameState) {
    const map = state.map;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const key = `${x},${y}`;
        const isVisible = state.visibleCells.includes(key);
        const isDiscovered = state.discoveredCells.includes(key);

        if (isVisible) {
          // No fog
          continue;
        }

        if (isDiscovered) {
          // Dim (Shroud)
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // 60% black
          this.ctx.fillRect(
            x * this.cellSize,
            y * this.cellSize,
            this.cellSize,
            this.cellSize
          );
        } else {
          // Hidden (Fog)
          this.ctx.fillStyle = '#000'; // 100% black
          this.ctx.fillRect(
            x * this.cellSize,
            y * this.cellSize,
            this.cellSize,
            this.cellSize
          );
        }
      }
    }
  }

  public getCellCoordinates(pixelX: number, pixelY: number): Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((pixelX - rect.left) / this.cellSize);
    const y = Math.floor((pixelY - rect.top) / this.cellSize);
    return { x, y };
  }
}
