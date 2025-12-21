import { MapDefinition, CellType, Cell, Door, SpawnPoint, ObjectiveDefinition, Vector2 } from '../../shared/types';
import { PRNG } from '../../shared/PRNG';
import { MapGenerator } from '../MapGenerator';

export class DenseShipGenerator {
  private prng: PRNG;
  private width: number;
  private height: number;
  private cells: Cell[] = [];
  private doors: Door[] = [];
  private spawnPoints: SpawnPoint[] = [];
  private objectives: ObjectiveDefinition[] = [];
  private extraction?: Vector2;

  constructor(seed: number, width: number, height: number) {
    this.prng = new PRNG(seed);
    this.width = width;
    this.height = height;
  }

  public generate(): MapDefinition {
    // 1. Initialize as Void
    this.cells = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cells.push({
          x, y,
          type: CellType.Wall,
          walls: { n: true, e: true, s: true, w: true }
        });
      }
    }

    // 2. Build Corridor Frame
    const corridors: Vector2[] = [];
    
    // Main Spine (Horizontal or Vertical)
    const isHorizontalSpine = this.prng.next() > 0.5;
    const spineLength = Math.floor((isHorizontalSpine ? this.width : this.height) * 0.8); // 80% length
    const spineStart = Math.floor(((isHorizontalSpine ? this.width : this.height) - spineLength) / 2);
    const spinePos = Math.floor((isHorizontalSpine ? this.height : this.width) / 2);

    if (isHorizontalSpine) {
        this.createCorridor(spineStart, spinePos, spineLength, 'horizontal', corridors);
    } else {
        this.createCorridor(spinePos, spineStart, spineLength, 'vertical', corridors);
    }

    // Secondary Corridors (Branches)
    // Try to place perpendicular branches
    const branchCount = 3;
    for (let i = 0; i < branchCount; i++) {
        // Pick a point on the spine (or existing corridors)
        if (corridors.length === 0) break;
        const startNode = corridors[this.prng.nextInt(0, corridors.length - 1)];
        
        // Determine direction perpendicular to current corridor? 
        // Hard without metadata. Let's just try random directions from random valid floor cells.
        const dirs = isHorizontalSpine ? ['n', 's'] : ['e', 'w']; // Simplify: branches perp to spine
        const dir = dirs[this.prng.nextInt(0, dirs.length - 1)];
        
        // Determine length
        const len = Math.floor((isHorizontalSpine ? this.height : this.width) * 0.6);
        
        // Find start: Scan from spine outwards?
        // Actually, let's just place lines and see if they fit.
        // Valid Frame: No parallel adjacent corridors.
        
        let cx = startNode.x;
        let cy = startNode.y;
        let dx = 0, dy = 0;
        if (dir === 'n') dy = -1;
        if (dir === 's') dy = 1;
        if (dir === 'e') dx = 1;
        if (dir === 'w') dx = -1;

        // Try to build a corridor
        // Must maintain 1 tile buffer from other corridors (except connection point)
        // Connection point is (cx, cy).
        // Check if we can extend at least 50%? Or just some length.
        this.tryCreateCorridor(cx, cy, dx, dy, len, corridors);
    }

    // 3. Fill with Rooms
    // Iterate over all Void cells. If adjacent to a Floor, try to grow a room.
    // Order: Random
    const indices = Array.from({length: this.width * this.height}, (_, i) => i);
    this.prng.shuffle(indices);

    for (const idx of indices) {
        const x = idx % this.width;
        const y = Math.floor(idx / this.width);
        const cell = this.getCell(x, y);
        
        if (cell && cell.type === CellType.Wall) {
            // Check for adjacent floor to connect to
            const neighbors = this.getNeighbors(x, y);
            const parent = neighbors.find(n => {
                const c = this.getCell(n.x, n.y);
                return c && c.type === CellType.Floor;
            });

            if (parent) {
                // Try to fit a room here
                this.tryPlaceRoom(x, y, parent);
            }
        }
    }

    // 3b. Final Aggressive Fill (1x1 Rooms)
    // To guarantee >90%, iterate again and turn ANY remaining reachable void into a 1x1 room.
    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            const cell = this.getCell(x, y);
            if (cell && cell.type === CellType.Wall) {
                const neighbors = this.getNeighbors(x, y);
                const parent = neighbors.find(n => {
                    const c = this.getCell(n.x, n.y);
                    return c && c.type === CellType.Floor;
                });
                
                if (parent) {
                    const roomId = `room-${x}-${y}`;
                    this.setFloor(x, y, roomId);
                    const dir = this.getDirection(parent, {x, y});
                    if (dir) this.openWall(parent.x, parent.y, dir);
                }
            }
        }
    }

    // 4. Entities
    // Place spawn on spine ends
    if (corridors.length > 0) {
        this.spawnPoints.push({ id: 'sp-1', pos: corridors[0], radius: 1 });
        this.extraction = corridors[corridors.length - 1];
        
        // Objective in a random room
        // Scan for rooms (we didn't track them explicitly, but we can scan cells)
        // Just pick a random floor not on spine ends
        let objPos = corridors[Math.floor(corridors.length / 2)];
        this.objectives.push({ id: 'obj-1', kind: 'Recover', targetCell: objPos });
    }

    const map: MapDefinition = {
      width: this.width,
      height: this.height,
      cells: this.cells,
      doors: this.doors,
      spawnPoints: this.spawnPoints,
      extraction: this.extraction,
      objectives: this.objectives
    };

    MapGenerator.sanitize(map);
    return map;
  }

  private getCell(x: number, y: number): Cell | undefined {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return undefined;
    return this.cells[y * this.width + x];
  }

  private setFloor(x: number, y: number, roomId?: string) {
    const c = this.getCell(x, y);
    if (c) {
        c.type = CellType.Floor;
        if (roomId) c.roomId = roomId;
    }
  }

  private createCorridor(x: number, y: number, length: number, orientation: 'horizontal'|'vertical', registry: Vector2[]) {
      const roomId = `corridor-${this.prng.next()}`; // Mark as corridor
      for (let i = 0; i < length; i++) {
          const cx = orientation === 'horizontal' ? x + i : x;
          const cy = orientation === 'horizontal' ? y : y + i;
          if (cx >= 0 && cx < this.width && cy >= 0 && cy < this.height) {
              this.setFloor(cx, cy, roomId);
              registry.push({x: cx, y: cy});
              // Connect to prev
              if (i > 0) {
                  if (orientation === 'horizontal') this.openWall(cx - 1, cy, 'e');
                  else this.openWall(cx, cy - 1, 's');
              }
          }
      }
  }

  private tryCreateCorridor(x: number, y: number, dx: number, dy: number, length: number, registry: Vector2[]) {
      // Check clearance: No adjacent parallel corridors.
      // We are growing from (x,y) in direction (dx,dy).
      // We need to check (x+i*dx, y+i*dy) AND its lateral neighbors.
      
      const potentialCells: Vector2[] = [];
      for (let i = 1; i <= length; i++) { // Start from 1 to skip connection point
          const cx = x + i*dx;
          const cy = y + i*dy;
          if (cx < 0 || cx >= this.width || cy < 0 || cy >= this.height) break;
          
          const cell = this.getCell(cx, cy);
          if (cell?.type === CellType.Floor) break; // Hit existing floor

          // Check neighbors for buffer (except back towards source)
          // If moving East (dx=1), check North (y-1) and South (y+1).
          // If neighbors are floor, invalid.
          let invalid = false;
          const lateralDirs = dx !== 0 ? [{x:0, y:-1}, {x:0, y:1}] : [{x:-1, y:0}, {x:1, y:0}];
          for (const l of lateralDirs) {
              const neighbor = this.getCell(cx + l.x, cy + l.y);
              if (neighbor && neighbor.type === CellType.Floor) {
                  invalid = true;
                  break;
              }
          }
          if (invalid) break;

          potentialCells.push({x: cx, y: cy});
      }

      if (potentialCells.length > 3) { // Min length
          const roomId = `corridor-${this.prng.next()}`;
          potentialCells.forEach((p, i) => {
              this.setFloor(p.x, p.y, roomId);
              registry.push(p);
              // Open wall to prev
              const prev = i === 0 ? {x, y} : potentialCells[i-1];
              const dir = this.getDirection(prev, p);
              if (dir) this.openWall(prev.x, prev.y, dir);
          });
      }
  }

  private tryPlaceRoom(x: number, y: number, parent: Vector2) {
      // Try 2x2, 2x1, 1x2, 1x1
      const shapes = [
          { w: 2, h: 2 },
          { w: 2, h: 1 },
          { w: 1, h: 2 },
          { w: 1, h: 1 }
      ];
      // Randomize shape order? Or prefer largest?
      // Prefer largest to maximize density.
      
      for (const shape of shapes) {
          // Can we fit shape at (x,y)?
          // We need to check if (x,y) to (x+w, y+h) are Void and valid
          // And we need to connect to parent.
          // Parent is adjacent to (x,y).
          
          // Actually, (x,y) is the anchor. We can expand in +x and +y.
          // Check bounds
          if (x + shape.w > this.width || y + shape.h > this.height) continue;

          let valid = true;
          const roomCells: Vector2[] = [];
          for (let dy = 0; dy < shape.h; dy++) {
              for (let dx = 0; dx < shape.w; dx++) {
                  const cx = x + dx;
                  const cy = y + dy;
                  const c = this.getCell(cx, cy);
                  if (!c || c.type === CellType.Floor) {
                      valid = false; 
                      break;
                  }
                  roomCells.push({x: cx, y: cy});
              }
              if (!valid) break;
          }

          if (valid) {
              const roomId = `room-${x}-${y}`;
              roomCells.forEach(p => this.setFloor(p.x, p.y, roomId));
              
              // Open internal walls
              for (let dy = 0; dy < shape.h; dy++) {
                  for (let dx = 0; dx < shape.w; dx++) {
                      const cx = x + dx;
                      const cy = y + dy;
                      if (dx < shape.w - 1) this.openWall(cx, cy, 'e'); // Right
                      if (dy < shape.h - 1) this.openWall(cx, cy, 's'); // Down
                  }
              }

              // Connect to parent
              // We know parent is adjacent to (x,y).
              const dir = this.getDirection(parent, {x, y});
              if (dir) {
                  // Door probability
                  if (this.prng.next() < 0.3) {
                      this.placeDoor(parent.x, parent.y, x, y);
                  } else {
                      this.openWall(parent.x, parent.y, dir);
                  }
              }
              return; // Placed!
          }
      }
  }

  private getNeighbors(x: number, y: number): Vector2[] {
      return [
          { x: x + 1, y },
          { x: x - 1, y },
          { x, y: y + 1 },
          { x, y: y - 1 }
      ].filter(n => n.x >= 0 && n.x < this.width && n.y >= 0 && n.y < this.height);
  }

  private getDirection(from: Vector2, to: Vector2): 'n'|'e'|'s'|'w' | null {
      if (to.x > from.x) return 'e';
      if (to.x < from.x) return 'w';
      if (to.y > from.y) return 's';
      if (to.y < from.y) return 'n';
      return null;
  }

  private openWall(x: number, y: number, dir: 'n'|'e'|'s'|'w') {
    const c = this.getCell(x, y);
    if (!c) return;
    c.walls[dir] = false;
    
    let nx = x, ny = y;
    let opp: 'n'|'e'|'s'|'w' = 's';
    if (dir === 'n') { ny--; opp = 's'; }
    if (dir === 'e') { nx++; opp = 'w'; }
    if (dir === 's') { ny++; opp = 'n'; }
    if (dir === 'w') { nx--; opp = 'e'; }
    
    const n = this.getCell(nx, ny);
    if (n) n.walls[opp] = false;
  }

  private placeDoor(x1: number, y1: number, x2: number, y2: number) {
      const doorId = `door-${this.doors.length}`;
      this.doors.push({
          id: doorId,
          segment: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
          orientation: x1 === x2 ? 'Horizontal' : 'Vertical',
          state: 'Closed',
          hp: 50,
          maxHp: 50,
          openDuration: 1
      });
  }
}
