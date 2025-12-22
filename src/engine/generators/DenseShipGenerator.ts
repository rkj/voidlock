import { MapDefinition, CellType, Cell, Door, SpawnPoint, ObjectiveDefinition, Vector2 } from '../../shared/types';
import { PRNG } from '../../shared/PRNG';
import { MapGenerator } from '../MapGenerator';

type GenCellType = 'Void' | 'Corridor' | 'Room';

export class DenseShipGenerator {
  private prng: PRNG;
  private width: number;
  private height: number;
  private cells: Cell[] = [];
  private doors: Door[] = [];
  private spawnPoints: SpawnPoint[] = [];
  private objectives: ObjectiveDefinition[] = [];
  private extraction?: Vector2;
  
  // Internal tracking
  private genMap: GenCellType[];
  private roomIds: string[];

  constructor(seed: number, width: number, height: number) {
    this.prng = new PRNG(seed);
    this.width = width;
    this.height = height;
    this.genMap = new Array(width * height).fill('Void');
    this.roomIds = new Array(width * height).fill('');
  }

  public generate(): MapDefinition {
    this.reset();

    // 1. Build Frame (Corridors)
    const corridors = this.buildFrame();

    // 2. Build Rooms (Depth 1+)
    // Iteratively scan for valid spots connected to existing Floor (Corridor or Room)
    // We repeat this pass until no more rooms can be placed to maximize density.
    let placed = true;
    while (placed) {
        placed = this.fillPass();
    }

    // 3. Finalize Map
    this.finalizeCells();
    this.placeEntities(corridors);

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

  // --- Debug / Golden Output ---
  public toDetailedDebugString(): string {
      const expandedWidth = this.width * 2 + 1;
      const expandedHeight = this.height * 2 + 1;
      const grid: string[][] = Array.from({ length: expandedHeight }, () => Array(expandedWidth).fill(' '));

      const getExEy = (x: number, y: number) => ({ ex: x * 2 + 1, ey: y * 2 + 1 });

      // 1. Cells and Walls
      for (let y = 0; y < this.height; y++) {
          for (let x = 0; x < this.width; x++) {
              const { ex, ey } = getExEy(x, y);
              const type = this.getGenType(x, y);
              
              // Cell Content
              grid[ey][ex] = type === 'Corridor' ? 'C' : type === 'Room' ? 'R' : '#';

              // Walls
              const cell = this.getCell(x, y);
              if (cell) {
                  if (cell.walls.n) grid[ey - 1][ex] = '-';
                  if (cell.walls.s) grid[ey + 1][ex] = '-';
                  if (cell.walls.e) grid[ey][ex + 1] = '|';
                  if (cell.walls.w) grid[ey][ex - 1] = '|';
              }
          }
      }

      // 2. Doors
      this.doors.forEach(d => {
          const [p1, p2] = d.segment;
          if (d.orientation === 'Horizontal') { // Door between (x,y) and (x,y+1) - wait, horizontal means horizontal BAR
             // Segment [p1, p2]. p1.x==p2.x. p1.y != p2.y.
             // If orientation is Horizontal, it visually is a horizontal line '='.
             // It sits on a horizontal edge (North/South).
             // p1.x == p2.x.
             const ex = p1.x * 2 + 1;
             const ey = Math.max(p1.y, p2.y) * 2; // Between y and y+1 is at 2*(y+1)? No.
             // y=0 -> ey=1. y=1 -> ey=3. Edge is at 2.
             grid[ey][ex] = '=';
          } else { // Vertical door 'I'
             const ey = p1.y * 2 + 1;
             const ex = Math.max(p1.x, p2.x) * 2;
             grid[ey][ex] = 'I';
          }
      });

      // 3. Corners
      for (let y = 0; y < expandedHeight; y += 2) {
          for (let x = 0; x < expandedWidth; x += 2) {
              if (grid[y][x] === ' ') grid[y][x] = '+';
          }
      }

      return grid.map(row => row.join('')).join('\n');
  }

  public toDebugString(): string {
      const symbols: Record<GenCellType, string> = {
          'Void': '.',
          'Corridor': 'C',
          'Room': 'R'
      };
      
      let out = '';
      for (let y = 0; y < this.height; y++) {
          let line = '';
          for (let x = 0; x < this.width; x++) {
              line += symbols[this.getGenType(x, y)];
          }
          out += line + '\n';
      }
      return out;
  }

  private reset() {
      this.cells = [];
      this.doors = [];
      this.spawnPoints = [];
      this.objectives = [];
      this.extraction = undefined;
      this.genMap.fill('Void');
      this.roomIds.fill('');
      
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          this.cells.push({
            x, y,
            type: CellType.Wall,
            walls: { n: true, e: true, s: true, w: true }
          });
        }
      }
  }

  private buildFrame(): Vector2[] {
      const corridors: Vector2[] = [];
      const minHLen = Math.ceil(this.width * 0.75);
      const minVLen = Math.ceil(this.height * 0.75);
      
      // 1. Primary Horizontal Spine
      const hSpineY = this.prng.nextInt(2, this.height - 3);
      const hSpineLen = this.prng.nextInt(minHLen, this.width);
      const hSpineX = this.prng.nextInt(0, this.width - hSpineLen);
      
      const hSpineId = 'corridor-h-spine';
      for (let x = hSpineX; x < hSpineX + hSpineLen; x++) {
          this.setGenType(x, hSpineY, 'Corridor', hSpineId);
          corridors.push({x, y: hSpineY});
          if (x > hSpineX) this.openWall(x - 1, hSpineY, 'e');
      }

      // 2. Primary Vertical Spine (must intersect horizontal)
      // Pick an X that is on the horizontal spine
      const vSpineX = this.prng.nextInt(Math.max(2, hSpineX), Math.min(this.width - 3, hSpineX + hSpineLen - 1));
      const vSpineLen = this.prng.nextInt(minVLen, this.height);
      const vSpineY = this.prng.nextInt(0, this.height - vSpineLen);
      
      // Ensure it actually intersects the H-Spine
      // If hSpineY is not in [vSpineY, vSpineY + vSpineLen), shift it
      let finalVSpineY = vSpineY;
      if (hSpineY < vSpineY) finalVSpineY = Math.max(0, hSpineY - Math.floor(vSpineLen/2));
      if (hSpineY >= vSpineY + vSpineLen) finalVSpineY = Math.min(this.height - vSpineLen, hSpineY - Math.floor(vSpineLen/2));

      const vSpineId = 'corridor-v-spine';
      for (let y = finalVSpineY; y < finalVSpineY + vSpineLen; y++) {
          this.setGenType(vSpineX, y, 'Corridor', vSpineId);
          corridors.push({x: vSpineX, y});
          if (y > finalVSpineY) {
              this.openWall(vSpineX, y - 1, 's');
          }
      }

      // 3. Optional extra corridors (must be long and spaced)
      // For a 12x12 or 16x16, 2 spines are usually enough for a frame.
      // I will stop here to ensure strictness, or add one more with spacing check.
      
      return corridors;
  }

  private fillPass(): boolean {
      let placedAny = false;
      // Shuffle indices
      const indices = Array.from({length: this.width * this.height}, (_, i) => i);
      this.prng.shuffle(indices);

      for (const idx of indices) {
          const x = idx % this.width;
          const y = Math.floor(idx / this.width);
          
          if (this.getGenType(x, y) !== 'Void') continue;

          // Check for a parent (Floor)
          const neighbors = this.getNeighbors(x, y);
          const potentialParents = neighbors.filter(n => this.getGenType(n.x, n.y) !== 'Void');
          
          if (potentialParents.length > 0) {
              // Pick one parent
              const parent = potentialParents[this.prng.nextInt(0, potentialParents.length - 1)];
              
              // Try to place a room attached here
              if (this.tryPlaceRoom(x, y, parent)) {
                  placedAny = true;
              }
          }
      }
      return placedAny;
  }

  private tryPlaceRoom(x: number, y: number, parent: Vector2): boolean {
      // Dimensions: 2x2, 2x1, 1x2, 1x1. Prefer larger.
      const shapes = [
          {w: 2, h: 2}, {w: 2, h: 1}, {w: 1, h: 2}, {w: 1, h: 1}
      ];

      for (const s of shapes) {
          // Check if shape fits in Void
          // (x,y) is the anchor.
          // BUT, (x,y) must connect to parent.
          // We can shift the shape origin such that one of its cells is (x,y).
          // For 2x2, there are 4 offsets. For 1x1, 1.
          
          const offsets: Vector2[] = [];
          for(let oy=0; oy<s.h; oy++) {
              for(let ox=0; ox<s.w; ox++) {
                  offsets.push({x: -ox, y: -oy});
              }
          }
          this.prng.shuffle(offsets);

          for (const off of offsets) {
              const originX = x + off.x;
              const originY = y + off.y;
              
              // Verify shape validity
              if (this.isValidRoomShape(originX, originY, s.w, s.h)) {
                  // Valid! Place it.
                  this.placeRoom(originX, originY, s.w, s.h, parent);
                  return true;
              }
          }
      }
      return false;
  }

  private isValidRoomShape(ox: number, oy: number, w: number, h: number): boolean {
      for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
              const cx = ox + dx;
              const cy = oy + dy;
              if (cx < 0 || cx >= this.width || cy < 0 || cy >= this.height) return false;
              if (this.getGenType(cx, cy) !== 'Void') return false;
          }
      }
      return true;
  }

  private placeRoom(ox: number, oy: number, w: number, h: number, parent: Vector2) {
      const roomId = `room-${ox}-${oy}`;
      
      // 1. Set Cells
      for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
              this.setGenType(ox + dx, oy + dy, 'Room', roomId);
          }
      }

      // 2. Open Internal Walls
      for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
              const cx = ox + dx;
              const cy = oy + dy;
              if (dx < w - 1) this.openWall(cx, cy, 'e');
              if (dy < h - 1) this.openWall(cx, cy, 's');
          }
      }

      // 3. Connect to Parent (SINGLE CONNECTION)
      // Find the cell in the room that is adjacent to the parent
      // Note: tryPlaceRoom was triggered by (x,y) being adjacent to parent.
      // But we shifted origin. We need to find which cell touches parent.
      let connectionFound = false;
      for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
              const cx = ox + dx;
              const cy = oy + dy;
              const dir = this.getDirection(parent, {x: cx, y: cy}); // Parent -> RoomCell
              if (dir) {
                  // Connect
                  // Use Door for Room connection
                  this.placeDoor(parent.x, parent.y, cx, cy);
                  connectionFound = true;
                  break; 
              }
          }
          if (connectionFound) break;
      }
  }

  private finalizeCells() {
      // Map GenCellType to CellType.Floor/Wall
      for(let i=0; i<this.width*this.height; i++) {
          if (this.genMap[i] === 'Void') {
              this.cells[i].type = CellType.Wall;
          } else {
              this.cells[i].type = CellType.Floor;
              if (this.roomIds[i]) this.cells[i].roomId = this.roomIds[i];
          }
      }
  }

  private placeEntities(corridors: Vector2[]) {
      if (corridors.length === 0) return;
      
      // Spawn at spine start
      this.spawnPoints.push({ id: 'sp-1', pos: corridors[0], radius: 1 });
      
      // Extraction at spine end (or furthest corridor point)
      this.extraction = corridors[corridors.length - 1];

      // Objectives in Rooms
      const roomCells: Vector2[] = [];
      for(let y=0; y<this.height; y++) {
          for(let x=0; x<this.width; x++) {
              if (this.getGenType(x, y) === 'Room') roomCells.push({x, y});
          }
      }
      
      if (roomCells.length > 0) {
          const objPos = roomCells[this.prng.nextInt(0, roomCells.length - 1)];
          this.objectives.push({ id: 'obj-1', kind: 'Recover', targetCell: objPos });
      } else {
          // Fallback to corridor
          const objPos = corridors[Math.floor(corridors.length/2)];
          this.objectives.push({ id: 'obj-1', kind: 'Recover', targetCell: objPos });
      }
  }

  // --- Helpers ---

  private getGenType(x: number, y: number): GenCellType {
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 'Void';
      return this.genMap[y * this.width + x];
  }

  private setGenType(x: number, y: number, type: GenCellType, roomId?: string) {
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
      this.genMap[y * this.width + x] = type;
      if (roomId) this.roomIds[y * this.width + x] = roomId;
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
      if (to.x === from.x + 1 && to.y === from.y) return 'e';
      if (to.x === from.x - 1 && to.y === from.y) return 'w';
      if (to.y === from.y + 1 && to.x === from.x) return 's';
      if (to.y === from.y - 1 && to.x === from.x) return 'n';
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

  private connect(p1: Vector2, p2: Vector2) {
      const dir = this.getDirection(p1, p2);
      if (dir) this.openWall(p1.x, p1.y, dir);
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

  private getCell(x: number, y: number): Cell | undefined {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return undefined;
    return this.cells[y * this.width + x];
  }
}