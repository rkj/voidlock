import { GameState, MapDefinition, CellType, Vector2, UnitState, Enemy, Door } from '../shared/types';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private cellSize: number = 128; // Increased tile size for M8

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
    const width = map.width * this.cellSize;
    const height = map.height * this.cellSize;

    if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    // Floor
    map.cells.forEach(cell => {
      if (cell.type === CellType.Floor) {
        this.ctx.fillStyle = '#0a0a0a'; // Very dark grey, almost black
        this.ctx.fillRect(
          cell.x * this.cellSize,
          cell.y * this.cellSize,
          this.cellSize,
          this.cellSize
        );
        
        // Grid lines (faint)
        this.ctx.strokeStyle = '#111';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(
          cell.x * this.cellSize,
          cell.y * this.cellSize,
          this.cellSize,
          this.cellSize
        );
      }
    });

    // Draw Walls and Doors
    this.ctx.lineCap = 'round';

    // Helper to check if a door exists on a specific wall segment
    const isDoor = (cellX: number, cellY: number, wallDirection: 'n'|'e'|'s'|'w'): boolean => {
      return map.doors?.some(door => {
        if (door.orientation === 'Horizontal') {
          if (wallDirection === 'n') { // Check if door is North of (cellX, cellY) i.e. between (cellX, cellY) and (cellX, cellY-1)
            return door.segment.some(segCell => segCell.x === cellX && segCell.y === cellY - 1);
          }
          if (wallDirection === 's') { // Check if door is South of (cellX, cellY) i.e. between (cellX, cellY) and (cellX, cellY+1)
            return door.segment.some(segCell => segCell.x === cellX && segCell.y === cellY);
          }
        } else if (door.orientation === 'Vertical') {
          if (wallDirection === 'w') { // Check if door is West of (cellX, cellY) i.e. between (cellX, cellY) and (cellX-1, cellY)
            return door.segment.some(segCell => segCell.x === cellX - 1 && segCell.y === cellY);
          }
          if (wallDirection === 'e') { // Check if door is East of (cellX, cellY) i.e. between (cellX, cellY) and (cellX+1, cellY)
            return door.segment.some(segCell => segCell.x === cellX && segCell.y === cellY);
          }
        }
        return false;
      }) || false;
    };

    // Render Walls (Neon Cyan)
    this.ctx.strokeStyle = '#00FFFF'; 
    this.ctx.lineWidth = 2; 
    this.ctx.beginPath();

    map.cells.forEach(cell => {
      if (cell.type !== CellType.Floor) return;

      const x = cell.x * this.cellSize;
      const y = cell.y * this.cellSize;
      const s = this.cellSize;

      // Draw walls only if no door is present
      // We draw wall segments slightly offset to avoid overlap issues if needed, but simple lines are fine for now.
      if (cell.walls.n && !isDoor(cell.x, cell.y, 'n')) { 
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + s, y);
      }
      if (cell.walls.e && !isDoor(cell.x, cell.y, 'e')) { 
        this.ctx.moveTo(x + s, y);
        this.ctx.lineTo(x + s, y + s);
      }
      if (cell.walls.s && !isDoor(cell.x, cell.y, 's')) { 
        this.ctx.moveTo(x, y + s);
        this.ctx.lineTo(x + s, y + s);
      }
      if (cell.walls.w && !isDoor(cell.x, cell.y, 'w')) { 
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x, y + s);
      }
    });
    this.ctx.stroke();

    // Render Doors
    map.doors?.forEach(door => {
      let doorColor: string = '#888';
      let doorStroke: string = '#AAA';
      
      if (door.state === 'Closed') { doorColor = '#FFD700'; doorStroke = '#FFAA00'; } // Gold/Yellow
      else if (door.state === 'Locked') { doorColor = '#FF0000'; doorStroke = '#880000'; } // Red
      else if (door.state === 'Destroyed') { doorColor = '#330000'; doorStroke = '#550000'; } // Dark Red rubble

      const doorThickness = this.cellSize / 8; 
      const doorInset = this.cellSize / 8; // Inset from corners to look like a mechanical door

      door.segment.forEach(segCell => {
        const x = segCell.x * this.cellSize;
        const y = segCell.y * this.cellSize;
        const s = this.cellSize;
        
        let drawX = x, drawY = y, drawWidth = s, drawHeight = s;

        if (door.state === 'Open') {
          // Open door: Draw "pockets" in the wall
          this.ctx.fillStyle = '#444';
          if (door.orientation === 'Vertical') {
             // Small boxes at top and bottom of the wall segment
             this.ctx.fillRect(x + s - 4, y, 4, doorInset); // Top pocket
             this.ctx.fillRect(x + s - 4, y + s - doorInset, 4, doorInset); // Bottom pocket
          } else {
             this.ctx.fillRect(x, y + s - 4, doorInset, 4); // Left pocket
             this.ctx.fillRect(x + s - doorInset, y + s - 4, doorInset, 4); // Right pocket
          }
        } else {
          // Closed/Locked
          this.ctx.fillStyle = doorColor;
          this.ctx.strokeStyle = doorStroke;
          this.ctx.lineWidth = 2;

          if (door.orientation === 'Vertical') { // Door is vertical (between x and x+1)
            drawX = x + s - doorThickness / 2;
            drawY = y + doorInset;
            drawWidth = doorThickness;
            drawHeight = s - (doorInset * 2);
          } else { // Horizontal (between y and y+1)
            drawX = x + doorInset;
            drawY = y + s - doorThickness / 2;
            drawWidth = s - (doorInset * 2);
            drawHeight = doorThickness;
          }
          
          this.ctx.fillRect(drawX, drawY, drawWidth, drawHeight);
          this.ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
          
          // Tactical symbol (X for locked, line for closed)
          if (door.state === 'Locked') {
              this.ctx.beginPath();
              this.ctx.moveTo(drawX, drawY);
              this.ctx.lineTo(drawX + drawWidth, drawY + drawHeight);
              this.ctx.moveTo(drawX + drawWidth, drawY);
              this.ctx.lineTo(drawX, drawY + drawHeight);
              this.ctx.stroke();
          }
        }
      });
    });
  }

  private getVisualOffset(unitId: string, pos: Vector2, allEntities: {id: string, pos: Vector2}[], radius: number): Vector2 {
      let dx = 0, dy = 0;
      let count = 0;
      for (const other of allEntities) {
          if (other.id === unitId) continue;
          const dist = Math.sqrt((pos.x - other.pos.x)**2 + (pos.y - other.pos.y)**2);
          if (dist < radius) { // Too close
              const angle = Math.atan2(pos.y - other.pos.y, pos.x - other.pos.x);
              const push = (radius - dist) / radius; // Stronger push when closer
              dx += Math.cos(angle) * push;
              dy += Math.sin(angle) * push;
              count++;
          }
      }
      if (count > 0) {
          // Normalize and scale
          const strength = 0.3; // Max 0.3 tiles offset
          return { x: dx * strength, y: dy * strength };
      }
      return { x: 0, y: 0 };
  }

  private renderObjectives(state: GameState) {
    if (state.map.extraction) {
      const ext = state.map.extraction;
      const x = ext.x * this.cellSize;
      const y = ext.y * this.cellSize;
      
      // Extraction Zone
      this.ctx.fillStyle = 'rgba(0, 255, 255, 0.2)'; 
      this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
      
      this.ctx.strokeStyle = '#00FFFF';
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([10, 5]);
      this.ctx.strokeRect(x + 5, y + 5, this.cellSize - 10, this.cellSize - 10);
      this.ctx.setLineDash([]);

      // Icon (E)
      this.ctx.fillStyle = '#00FFFF';
      this.ctx.font = `bold ${this.cellSize/2}px Courier New`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('EXIT', x + this.cellSize/2, y + this.cellSize/2);
    }

    state.map.spawnPoints?.forEach(sp => {
        const x = sp.pos.x * this.cellSize;
        const y = sp.pos.y * this.cellSize;
        
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
        
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
        this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
        
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.font = `${this.cellSize/4}px Courier New`;
        this.ctx.fillText('SPAWN', x + this.cellSize/2, y + this.cellSize - 10);
    });

    state.objectives?.forEach(obj => {
      if (obj.state === 'Pending' && obj.targetCell) {
        this.ctx.fillStyle = '#FFAA00'; 
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillRect(
          obj.targetCell.x * this.cellSize + 4,
          obj.targetCell.y * this.cellSize + 4,
          this.cellSize - 8,
          this.cellSize - 8
        );
        this.ctx.globalAlpha = 1.0;
        
        this.ctx.fillStyle = '#FFAA00';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = `bold ${this.cellSize/2}px Arial`;
        this.ctx.fillText('OBJ', obj.targetCell.x * this.cellSize + this.cellSize/2, obj.targetCell.y * this.cellSize + this.cellSize/2);
      }
    });
  }

  private renderUnits(state: GameState) {
    const allEntities = [...state.units, ...state.enemies.filter(e => e.hp > 0)]; // For collision consideration

    state.units.forEach(unit => {
      if (unit.state === UnitState.Extracted || unit.state === UnitState.Dead) return;

      const offset = this.getVisualOffset(unit.id, unit.pos, allEntities, 0.5); // 0.5 tile radius for checking overlap
      const x = (unit.pos.x + offset.x) * this.cellSize; 
      const y = (unit.pos.y + offset.y) * this.cellSize;

      this.ctx.beginPath();
      // Unit size: 1/6 radius = 1/3 diameter relative to cell.
      // 128 / 6 ~= 21px radius -> 42px diameter.
      this.ctx.arc(x, y, this.cellSize / 6, 0, Math.PI * 2);
      
      if (unit.state === UnitState.Attacking) {
        this.ctx.fillStyle = '#FF4400'; 
      } else if (unit.state === UnitState.Moving) {
        this.ctx.fillStyle = '#FFD700'; 
      } else {
        this.ctx.fillStyle = '#00FF00'; 
      }
      
      this.ctx.fill();
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();

      this.renderHealthBar(x, y, unit.hp, unit.maxHp);

      if (unit.state === UnitState.Moving && unit.targetPos) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(unit.targetPos.x * this.cellSize, unit.targetPos.y * this.cellSize);
        this.ctx.strokeStyle = '#FF00FF'; 
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 10]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }

      if (unit.lastAttackTarget && unit.lastAttackTime && (state.t - unit.lastAttackTime < 150)) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, y);
          this.ctx.lineTo(unit.lastAttackTarget.x * this.cellSize, unit.lastAttackTarget.y * this.cellSize);
          this.ctx.strokeStyle = '#FFFF00'; 
          this.ctx.lineWidth = 3;
          this.ctx.stroke();
      }
    });
  }

  private renderEnemies(state: GameState) {
    const allEntities = [...state.units, ...state.enemies.filter(e => e.hp > 0)];

    state.enemies.forEach(enemy => {
      if (enemy.hp <= 0) return;

      const cellKey = `${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`;
      if (!state.visibleCells.includes(cellKey)) return;

      const offset = this.getVisualOffset(enemy.id, enemy.pos, allEntities, 0.5);
      const x = (enemy.pos.x + offset.x) * this.cellSize;
      const y = (enemy.pos.y + offset.y) * this.cellSize;
      const size = this.cellSize / 6;

      this.ctx.beginPath();
      this.ctx.moveTo(x, y - size);
      this.ctx.lineTo(x + size, y + size);
      this.ctx.lineTo(x - size, y + size);
      this.ctx.closePath();
      
      this.ctx.fillStyle = '#FF0000'; 
      this.ctx.fill();
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();

      this.renderHealthBar(x, y, enemy.hp, enemy.maxHp);

      if (enemy.lastAttackTarget && enemy.lastAttackTime && (state.t - enemy.lastAttackTime < 150)) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, y);
          this.ctx.lineTo(enemy.lastAttackTarget.x * this.cellSize, enemy.lastAttackTarget.y * this.cellSize);
          this.ctx.strokeStyle = '#FF8800'; 
          this.ctx.lineWidth = 3;
          this.ctx.stroke();
      }
    });
  }

  private renderHealthBar(x: number, y: number, hp: number, maxHp: number) {
    const barWidth = this.cellSize * 0.5;
    const barHeight = 6;
    const yOffset = -this.cellSize / 6 - 12;

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

        if (isVisible) continue;

        if (isDiscovered) {
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; 
          this.ctx.fillRect(
            x * this.cellSize,
            y * this.cellSize,
            this.cellSize,
            this.cellSize
          );
        } else {
          this.ctx.fillStyle = '#000'; 
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
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const x = Math.floor((pixelX - rect.left) * scaleX / this.cellSize);
    const y = Math.floor((pixelY - rect.top) * scaleY / this.cellSize);
    return { x, y };
  }
}