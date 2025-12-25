import { MapDefinition, CellType, Cell, Door, SpawnPoint, Objective, Vector2, WallDefinition } from '../../shared/types';
import { PRNG } from '../../shared/PRNG';
import { MapGenerator } from '../MapGenerator';

export class SpaceshipGenerator {
  private prng: PRNG;
  private width: number;
  private height: number;
  private cells: Cell[] = [];
  private walls: Set<string> = new Set();
  private doors: Door[] = [];
  private spawnPoints: SpawnPoint[] = [];
  private objectives: Objective[] = [];
  private extraction?: { x: number, y: number };

  constructor(seed: number, width: number, height: number) {
    this.prng = new PRNG(seed);
    this.width = width;
    this.height = height;
  }

  private getBoundaryKey(x1: number, y1: number, x2: number, y2: number): string {
    const p1 = `${x1},${y1}`;
    const p2 = `${x2},${y2}`;
    return [p1, p2].sort().join('--');
  }

  public generate(spawnPointCount: number = 1): MapDefinition {
    // 1. Initialize Grid (Void) and all boundaries as walls
    this.cells = Array(this.height * this.width).fill(null).map((_, i) => ({
      x: i % this.width,
      y: Math.floor(i / this.width),
      type: CellType.Wall
    }));

    this.walls.clear();
    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            // Horizontal wall (separates from neighbor to the right)
            this.walls.add(this.getBoundaryKey(x, y, x + 1, y));
            // Vertical wall (separates from neighbor below)
            this.walls.add(this.getBoundaryKey(x, y, x, y + 1));
            // Borders (negative coords)
            if (x === 0) this.walls.add(this.getBoundaryKey(-1, y, 0, y));
            if (y === 0) this.walls.add(this.getBoundaryKey(x, -1, x, 0));
        }
    }

    // 2. Place Dense Rooms
    const targetRoomArea = (this.width * this.height) * 0.4;
    let currentRoomArea = 0;
    let attempts = 0;
    const maxAttempts = 2000;
    const rooms: {x: number, y: number, w: number, h: number}[] = [];

    while (currentRoomArea < targetRoomArea && attempts < maxAttempts) {
        attempts++;
        const w = this.prng.nextInt(1, 2); 
        const h = this.prng.nextInt(1, 2); 
        const x = this.prng.nextInt(1, this.width - w - 1);
        const y = this.prng.nextInt(1, this.height - h - 1);

        let collision = false;
        for (let dy = -1; dy <= h; dy++) {
            for (let dx = -1; dx <= w; dx++) {
                const cell = this.getCell(x + dx, y + dy);
                if (cell && cell.type === CellType.Floor) {
                    collision = true;
                    break;
                }
            }
            if (collision) break;
        }

        if (!collision) {
            const roomId = `room-${x}-${y}`;
            for (let dy = 0; dy < h; dy++) {
                for (let dx = 0; dx < w; dx++) {
                    this.setFloor(x + dx, y + dy);
                    const cell = this.getCell(x + dx, y + dy);
                    if (cell) cell.roomId = roomId;
                    if (dx < w - 1) this.openWall(x + dx, y + dy, 'e');
                    if (dy < h - 1) this.openWall(x + dx, y + dy, 's');
                }
            }
            rooms.push({x, y, w, h});
            currentRoomArea += w * h;
        }
    }

    // 3. Maze Generation
    const stack: {x: number, y: number}[] = [];
    let startX = 1; let startY = 1;
    for (let i=0; i<100; i++) {
        const tx = this.prng.nextInt(1, this.width - 2);
        const ty = this.prng.nextInt(1, this.height - 2);
        if (this.getCell(tx, ty)?.type === CellType.Wall) {
            startX = tx; startY = ty;
            break;
        }
    }
    
    if (this.getCell(startX, startY)?.type === CellType.Wall) {
        this.setFloor(startX, startY);
        const cell = this.getCell(startX, startY);
        if (cell) cell.roomId = 'corridor-maze';
        stack.push({x: startX, y: startY});
    }

    const dirs = [{dx:0, dy:-1, k:'n'}, {dx:0, dy:1, k:'s'}, {dx:1, dy:0, k:'e'}, {dx:-1, dy:0, k:'w'}];
    while (stack.length > 0) {
        const current = stack[stack.length - 1]; 
        const neighbors: any[] = [];
        const shuffledDirs = [...dirs].sort(() => this.prng.next() - 0.5);

        for (const dir of shuffledDirs) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;
            const neighbor = this.getCell(nx, ny);
            if (neighbor && neighbor.type === CellType.Wall) {
                neighbors.push({ x: nx, y: ny, dir: dir.k });
            }
        }

        if (neighbors.length > 0) {
            const next = neighbors[0]; 
            this.setFloor(next.x, next.y);
            const cell = this.getCell(next.x, next.y);
            if (cell) cell.roomId = 'corridor-maze';
            this.openWall(current.x, current.y, next.dir as any);
            stack.push({x: next.x, y: next.y});
        } else {
            stack.pop();
        }
    }

    // 4. Connect Disconnected Regions
    rooms.forEach(room => {
        const connections: {x: number, y: number, dir: string}[] = [];
        for (let dy = 0; dy < room.h; dy++) {
            if (this.getCell(room.x - 1, room.y + dy)?.type === CellType.Floor) connections.push({x: room.x, y: room.y + dy, dir: 'w'});
            if (this.getCell(room.x + room.w, room.y + dy)?.type === CellType.Floor) connections.push({x: room.x + room.w - 1, y: room.y + dy, dir: 'e'});
        }
        for (let dx = 0; dx < room.w; dx++) {
            if (this.getCell(room.x + dx, room.y - 1)?.type === CellType.Floor) connections.push({x: room.x + dx, y: room.y, dir: 'n'});
            if (this.getCell(room.x + dx, room.y + room.h)?.type === CellType.Floor) connections.push({x: room.x + dx, y: room.y + room.h - 1, dir: 's'});
        }

        if (connections.length > 0) {
            const conn = connections[this.prng.nextInt(0, connections.length - 1)];
            this.placeDoor(conn.x, conn.y, conn.dir);
            if (connections.length > 1 && this.prng.next() < 0.4) {
                let conn2 = connections[this.prng.nextInt(0, connections.length - 1)];
                while (conn2 === conn) conn2 = connections[this.prng.nextInt(0, connections.length - 1)];
                this.placeDoor(conn2.x, conn2.y, conn2.dir);
            }
        }
    });

    // 5. Ensure Full Connectivity
    for (let y = 1; y < this.height - 1; y++) {
        for (let x = 1; x < this.width - 1; x++) {
            if (this.getCell(x, y)?.type === CellType.Wall) {
                const floorNeighbors = dirs.map(d => ({x: x + d.dx, y: y + d.dy, d: d.k})).filter(n => this.getCell(n.x, n.y)?.type === CellType.Floor);
                if (floorNeighbors.length > 0) {
                    const n = floorNeighbors[this.prng.nextInt(0, floorNeighbors.length - 1)];
                    this.setFloor(x, y);
                    const cell = this.getCell(x, y);
                    if (cell) cell.roomId = 'corridor-patch';
                    this.openWall(x, y, n.d as any);
                }
            }
        }
    }

    // 6. Place Features
    this.placeFeatures(spawnPointCount);

    const mapWalls: WallDefinition[] = [];
    this.walls.forEach(key => {
        const parts = key.split('--').map(p => p.split(',').map(Number));
        mapWalls.push({ p1: {x: parts[0][0], y: parts[0][1]}, p2: {x: parts[1][0], y: parts[1][1]} });
    });

    const map: MapDefinition = {
        width: this.width,
        height: this.height,
        cells: this.cells,
        walls: mapWalls,
        doors: this.doors,
        spawnPoints: this.spawnPoints,
        extraction: this.extraction,
        objectives: this.objectives
    };

    MapGenerator.sanitize(map);
    return map;
  }

  private setFloor(x: number, y: number) {
      const cell = this.getCell(x, y);
      if (cell) cell.type = CellType.Floor;
  }

  private getCell(x: number, y: number): Cell | undefined {
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) return undefined;
      return this.cells[y * this.width + x];
  }

  private openWall(x: number, y: number, dir: 'n'|'e'|'s'|'w') {
      let x2 = x, y2 = y;
      if (dir === 'n') y2--; else if (dir === 'e') x2++; else if (dir === 's') y2++; else if (dir === 'w') x2--;
      this.walls.delete(this.getBoundaryKey(x, y, x2, y2));
  }

  private placeDoor(x: number, y: number, dir: string) {
      const doorId = `door-${this.doors.length}`;
      let segment: Vector2[];
      let orientation: 'Horizontal' | 'Vertical';
      if (dir === 'n') { orientation = 'Horizontal'; segment = [{x, y: y-1}, {x, y}]; }
      else if (dir === 's') { orientation = 'Horizontal'; segment = [{x, y}, {x, y: y+1}]; }
      else if (dir === 'w') { orientation = 'Vertical'; segment = [{x: x-1, y}, {x, y}]; }
      else { orientation = 'Vertical'; segment = [{x, y}, {x: x+1, y}]; }

      this.openWall(x, y, dir as any); // Door opens the wall in map.walls
      this.doors.push({ id: doorId, state: 'Closed', orientation, segment, hp: 50, maxHp: 50, openDuration: 1 });
  }

  private placeFeatures(spawnPointCount: number) {
      const floors = this.cells.filter(c => c.type === CellType.Floor);
      if (floors.length === 0) return;
      const roomFloors = floors.filter(c => c.roomId && c.roomId.startsWith('room-'));
      const spawnCandidates = roomFloors.length > 0 ? roomFloors : floors;

      let referenceX = 0;
      if (spawnPointCount === 1) {
          const sp = spawnCandidates.sort((a,b) => a.x - b.x)[0];
          this.spawnPoints.push({ id: 'spawn-1', pos: { x: sp.x, y: sp.y }, radius: 1 });
          referenceX = sp.x;
      } else {
          const leftMost = spawnCandidates.sort((a,b) => a.x - b.x).slice(0, Math.min(20, spawnCandidates.length));
          for (let i = 0; i < spawnPointCount; i++) {
              const sp = leftMost[this.prng.nextInt(0, leftMost.length - 1)];
              this.spawnPoints.push({ id: `spawn-${i + 1}`, pos: { x: sp.x, y: sp.y }, radius: 1 });
          }
          referenceX = leftMost.length > 0 ? leftMost[0].x : 0;
      }

      const rightMost = floors.sort((a,b) => b.x - a.x)[0];
      this.extraction = { x: rightMost.x, y: rightMost.y };
      const objectiveCandidates = roomFloors.filter(c => Math.abs(c.x - referenceX) > 5);
      const finalObjCandidates = objectiveCandidates.length > 0 ? objectiveCandidates : floors.filter(c => Math.abs(c.x - referenceX) > 5);

      if (finalObjCandidates.length > 0) {
          const objCell = finalObjCandidates[this.prng.nextInt(0, finalObjCandidates.length - 1)];
          this.objectives.push({ id: 'obj-1', kind: 'Recover', targetCell: { x: objCell.x, y: objCell.y }, state: 'Pending' });
      }
  }
}