import { GameState, MapDefinition, CellType, UnitState, Vector2, Door, Objective, OverlayOption } from '../shared/types';
import { Icons } from './Icons';
import { LineOfSight } from '../engine/LineOfSight';
import { GameGrid } from '../engine/GameGrid';
import { VisibilityPolygon } from './VisibilityPolygon';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private cellSize: number = 128; // Increased tile size for M8
  private iconImages: Record<string, HTMLImageElement> = {};
  private overlayOptions: OverlayOption[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    // Load Icons
    Object.entries(Icons).forEach(([key, src]) => {
          const img = new Image();
          img.src = src;
          this.iconImages[key] = img;
      });
  }

  public setCellSize(size: number) {
    this.cellSize = size;
  }

  public setOverlay(options: OverlayOption[]) {
      this.overlayOptions = options;
  }

  public render(state: GameState) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.renderMap(state);
    this.renderObjectives(state);
    this.renderUnits(state);
    this.renderEnemies(state);
    if (state.debugOverlayEnabled) {
        this.renderDebugOverlay(state);
    }
    this.renderFog(state);
    if (state.losOverlayEnabled) {
        this.renderLOSOverlay(state);
    }
    this.renderOverlay();
  }

  private renderLOSOverlay(state: GameState) {
      // Render Soldier LOS (Green)
      this.ctx.fillStyle = 'rgba(0, 255, 0, 0.2)'; // Slightly more opaque
      state.units.forEach(u => {
          if (u.hp > 0 && u.state !== UnitState.Extracted && u.state !== UnitState.Dead) {
              const polygon = VisibilityPolygon.compute(u.pos, u.sightRange || 10, state.map);
              
              if (polygon.length > 0) {
                  this.ctx.beginPath();
                  this.ctx.moveTo(polygon[0].x * this.cellSize, polygon[0].y * this.cellSize);
                  for (let i = 1; i < polygon.length; i++) {
                      this.ctx.lineTo(polygon[i].x * this.cellSize, polygon[i].y * this.cellSize);
                  }
                  this.ctx.closePath();
                  this.ctx.fill();
                  
                  // Optional: Stroke for definition
                  this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
                  this.ctx.lineWidth = 2;
                  this.ctx.stroke();
              }
          }
      });

      // Render Enemy LOS (Red)
      this.ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
      state.enemies.forEach(e => {
          if (e.hp > 0) {
              const polygon = VisibilityPolygon.compute(e.pos, 10, state.map);
              
              if (polygon.length > 0) {
                  this.ctx.beginPath();
                  this.ctx.moveTo(polygon[0].x * this.cellSize, polygon[0].y * this.cellSize);
                  for (let i = 1; i < polygon.length; i++) {
                      this.ctx.lineTo(polygon[i].x * this.cellSize, polygon[i].y * this.cellSize);
                  }
                  this.ctx.closePath();
                  this.ctx.fill();

                  this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
                  this.ctx.lineWidth = 2;
                  this.ctx.stroke();
              }
          }
      });
  }

  private renderOverlay() {
      if (this.overlayOptions.length === 0) return;
      
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.font = 'bold 20px Arial';

      this.overlayOptions.forEach(opt => {
          if (opt.pos) {
              let drawX = opt.pos.x;
              let drawY = opt.pos.y;
              
              if (Number.isInteger(drawX)) drawX += 0.5;
              if (Number.isInteger(drawY)) drawY += 0.5;
              
              const cx = drawX * this.cellSize;
              const cy = drawY * this.cellSize;
              
              // Draw Circle background
              this.ctx.fillStyle = 'rgba(255, 255, 0, 0.8)'; // Yellow
              this.ctx.beginPath();
              this.ctx.arc(cx, cy, 12, 0, Math.PI * 2);
              this.ctx.fill();
              
              // Draw Number
              this.ctx.fillStyle = '#000';
              this.ctx.fillText(opt.key, cx, cy);
          }
      });
  }

  private renderDebugOverlay(state: GameState) {
      const map = state.map;
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      this.ctx.font = '10px Arial';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'top';

      for (let y = 0; y < map.height; y++) {
          for (let x = 0; x < map.width; x++) {
              this.ctx.fillText(`${x},${y}`, x * this.cellSize + 2, y * this.cellSize + 2);
          }
      }

      // Debug Doors
      map.doors?.forEach(door => {
          if (door.segment.length !== 2) return;
          const [p1, p2] = door.segment;
          const cx = (p1.x + p2.x) / 2 * this.cellSize + this.cellSize / 2;
          const cy = (p1.y + p2.y) / 2 * this.cellSize + this.cellSize / 2;
          
          this.ctx.fillStyle = '#FF00FF';
          this.ctx.beginPath();
          this.ctx.arc(cx, cy, 5, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.fillText(door.id, cx + 8, cy);
      });
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
          if (wallDirection === 'n') { // North wall of (cellX, cellY) -> door between (cellX, cellY) and (cellX, cellY-1)
            const hasA = door.segment.some(s => s.x === cellX && s.y === cellY);
            const hasB = door.segment.some(s => s.x === cellX && s.y === cellY - 1);
            return hasA && hasB;
          }
          if (wallDirection === 's') { // South wall of (cellX, cellY) -> door between (cellX, cellY) and (cellX, cellY+1)
            const hasA = door.segment.some(s => s.x === cellX && s.y === cellY);
            const hasB = door.segment.some(s => s.x === cellX && s.y === cellY + 1);
            return hasA && hasB;
          }
        } else if (door.orientation === 'Vertical') {
          if (wallDirection === 'w') { // West wall of (cellX, cellY) -> door between (cellX, cellY) and (cellX-1, cellY)
            const hasA = door.segment.some(s => s.x === cellX && s.y === cellY);
            const hasB = door.segment.some(s => s.x === cellX - 1 && s.y === cellY);
            return hasA && hasB;
          }
          if (wallDirection === 'e') { // East wall of (cellX, cellY) -> door between (cellX, cellY) and (cellX+1, cellY)
            const hasA = door.segment.some(s => s.x === cellX && s.y === cellY);
            const hasB = door.segment.some(s => s.x === cellX + 1 && s.y === cellY);
            return hasA && hasB;
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
                const doorThickness = this.cellSize / 8; // Thicker
                const doorLength = this.cellSize / 3; // 1/3 width
          
                if (door.segment.length !== 2) return;          const [p1, p2] = door.segment;
          
          const s = this.cellSize;
          let startX, startY, endX, endY;
          let strut1_sx, strut1_sy, strut1_ex, strut1_ey;
          let strut2_sx, strut2_sy, strut2_ex, strut2_ey;
    
          if (door.orientation === 'Vertical') { 
            // Door on right edge of minX cell
            const cellX = Math.min(p1.x, p2.x);
            const cellY = p1.y;
            
            const wallX = (cellX + 1) * s;
            const wallY = cellY * s;
    
            startX = wallX;
            startY = wallY + (s - doorLength)/2;
            endX = wallX;
            endY = startY + doorLength;
            
            strut1_sx = wallX; strut1_sy = wallY; strut1_ex = wallX; strut1_ey = startY;
            strut2_sx = wallX; strut2_sy = endY; strut2_ex = wallX; strut2_ey = wallY + s;
          } else { 
            // Horizontal on bottom edge of minY cell
            const cellX = p1.x;
            const cellY = Math.min(p1.y, p2.y);
            
            const wallX = cellX * s;
            const wallY = (cellY + 1) * s;
            
            startX = wallX + (s - doorLength)/2;
            startY = wallY;
            endX = startX + doorLength;
            endY = wallY;
    
            strut1_sx = wallX; strut1_sy = wallY; strut1_ex = startX; strut1_ey = wallY;
            strut2_sx = endX; strut2_sy = wallY; strut2_ex = wallX + s; strut2_ey = wallY;
          }
          
                this.ctx.lineWidth = doorThickness;
          
                
          
                let openRatio = 0;
          
                if (door.state === 'Open' && !door.targetState) openRatio = 1;
          
                else if (door.state === 'Closed' && door.targetState === 'Open' && door.openTimer && door.openDuration) {
          
                    openRatio = 1 - (door.openTimer / (door.openDuration * 1000));
          
                } else if (door.state === 'Open' && door.targetState === 'Closed' && door.openTimer && door.openDuration) {
          
                    openRatio = door.openTimer / (door.openDuration * 1000);
          
                }
          
          
          
                const slideOffset = openRatio * (doorLength / 2);
          
          
          
                // Colors
          
                if (door.state === 'Locked' || door.targetState === 'Locked') {
          
                  this.ctx.strokeStyle = '#FF0000'; // Red
          
                } else if (door.state === 'Destroyed') {
          
                  this.ctx.strokeStyle = '#550000';
          
                } else {
          
                  this.ctx.strokeStyle = '#FFD700'; // Gold (even when open/opening, maybe dim it?)
          
                  if (openRatio > 0.8) this.ctx.strokeStyle = '#AA8800'; // Dim when fully open
          
                }
          
          
          
                if (door.state === 'Destroyed') {
          
                    // Draw rubble? Just simple line for now or nothing
          
                } else {
          
                    // Draw two segments sliding apart
          
                    // Center is (startX + endX)/2, (startY + endY)/2
          
                    const cx = (startX + endX) / 2;
          
                    const cy = (startY + endY) / 2;
          
                    
          
                    // Vector along door
          
                    const dx = endX - startX;
          
                    const dy = endY - startY;
          
                    const len = Math.sqrt(dx*dx + dy*dy);
          
                    const ux = dx / len;
          
                    const uy = dy / len;
          
          
          
                    // Left Half (from start towards center)
          
                    // Ends at center - slideOffset
          
                    this.ctx.beginPath();
          
                    this.ctx.moveTo(startX, startY);
          
                    this.ctx.lineTo(cx - ux * slideOffset, cy - uy * slideOffset);
          
                    this.ctx.stroke();
          
          
          
                    // Right Half (from end towards center)
          
                    // Starts at center + slideOffset
          
                    this.ctx.beginPath();
          
                    this.ctx.moveTo(endX, endY);
          
                    this.ctx.lineTo(cx + ux * slideOffset, cy + uy * slideOffset);
          
                    this.ctx.stroke();
          
                }
          
          
          
                // Draw struts if not destroyed (always drawn to bridge gap)
          
                if (door.state !== 'Destroyed') {
          
                    this.ctx.lineWidth = 2; // Match regular wall width
          
                    this.ctx.strokeStyle = '#00FFFF'; // Wall color
          
                    
          
                    this.ctx.beginPath();
          
                    this.ctx.moveTo(strut1_sx, strut1_sy);
          
                    this.ctx.lineTo(strut1_ex, strut1_ey);
          
                    this.ctx.stroke();
          
          
          
                    this.ctx.beginPath();
          
                    this.ctx.moveTo(strut2_sx, strut2_sy);
          
                    this.ctx.lineTo(strut2_ex, strut2_ey);
          
                    this.ctx.stroke();
          
                }
          
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
      this.ctx.fillStyle = 'rgba(0, 255, 255, 0.1)'; 
      this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
      
      this.ctx.strokeStyle = '#00FFFF';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([10, 5]);
      this.ctx.strokeRect(x + 5, y + 5, this.cellSize - 10, this.cellSize - 10);
      this.ctx.setLineDash([]);

      // Icon
      const icon = this.iconImages.Exit;
      if (icon) {
          const iconSize = this.cellSize * 0.6;
          this.ctx.drawImage(icon, x + (this.cellSize - iconSize)/2, y + (this.cellSize - iconSize)/2, iconSize, iconSize);
      }
    }

    state.map.spawnPoints?.forEach(sp => {
        const x = sp.pos.x * this.cellSize;
        const y = sp.pos.y * this.cellSize;
        
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.05)';
        this.ctx.fillRect(x, y, this.cellSize, this.cellSize);

        const icon = this.iconImages.Spawn;
        if (icon) {
            const iconSize = this.cellSize * 0.5;
            this.ctx.drawImage(icon, x + (this.cellSize - iconSize)/2, y + (this.cellSize - iconSize)/2, iconSize, iconSize);
        }
    });

    state.objectives?.forEach(obj => {
      if (obj.state === 'Pending' && obj.targetCell && obj.visible) {
        const x = obj.targetCell.x * this.cellSize;
        const y = obj.targetCell.y * this.cellSize;

        this.ctx.fillStyle = 'rgba(255, 170, 0, 0.1)'; 
        this.ctx.fillRect(x + 4, y + 4, this.cellSize - 8, this.cellSize - 8);
        
        const icon = this.iconImages.Objective;
        if (icon) {
            const iconSize = this.cellSize * 0.6;
            this.ctx.drawImage(icon, x + (this.cellSize - iconSize)/2, y + (this.cellSize - iconSize)/2, iconSize, iconSize);
        }
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
      if (enemy.type === 'Hive') {
          // Hive: Large Purple Square
          this.ctx.fillStyle = '#9900FF'; 
          const hiveSize = this.cellSize * 0.6;
          this.ctx.rect(x - hiveSize/2, y - hiveSize/2, hiveSize, hiveSize);
          this.ctx.fill();
          this.ctx.strokeStyle = '#FFFFFF';
          this.ctx.lineWidth = 4;
          this.ctx.stroke();
      } else {
          // Regular Enemy: Red Triangle
          this.ctx.moveTo(x, y - size);
          this.ctx.lineTo(x + size, y + size);
          this.ctx.lineTo(x - size, y + size);
          this.ctx.closePath();
          
          this.ctx.fillStyle = '#FF0000'; 
          this.ctx.fill();
          this.ctx.strokeStyle = '#000';
          this.ctx.lineWidth = 3;
          this.ctx.stroke();
      }

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