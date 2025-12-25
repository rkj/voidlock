import { MapDefinition, CellType, Cell, Door, SpawnPoint, Objective, Vector2, WallDefinition } from '../../shared/types';
import { PRNG } from '../../shared/PRNG';
import { MapGenerator } from '../MapGenerator';

export class TreeShipGenerator {
  private prng: PRNG;
  private width: number;
  private height: number;
  private cells: Cell[] = [];
  private walls: Set<string> = new Set();
  private doors: Door[] = [];
  private spawnPoints: SpawnPoint[] = [];
  private objectives: Objective[] = [];
  private extraction?: { x: number, y: number };
  private frontier: {parentX: number, parentY: number, dir: 'n'|'s'|'e'|'w', state: 'NewRoom'|'ExpandRoom'}[] = [];
  
  constructor(seed: number, width: number, height: number) {
    this.prng = new PRNG(seed);
    this.width = Math.min(width, 16);
    this.height = Math.min(height, 16);
  }

  private getBoundaryKey(x1: number, y1: number, x2: number, y2: number): string {
    const p1 = `${x1},${y1}`;
    const p2 = `${x2},${y2}`;
    return [p1, p2].sort().join('--');
  }

  public generate(spawnPointCount: number = 1): MapDefinition {
    // 1. Initialize Grid (Void) and walls
    this.cells = Array(this.height * this.width).fill(null).map((_, i) => ({
      x: i % this.width,
      y: Math.floor(i / this.width),
      type: CellType.Wall
    }));

    this.walls.clear();
    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            this.walls.add(this.getBoundaryKey(x, y, x + 1, y));
            this.walls.add(this.getBoundaryKey(x, y, x, y + 1));
            if (x === 0) this.walls.add(this.getBoundaryKey(-1, y, 0, y));
            if (y === 0) this.walls.add(this.getBoundaryKey(x, -1, x, 0));
        }
    }

    const spineCells: {x: number, y: number}[] = [];

    // 2. Main Skeleton
    this.generateSkeleton(spineCells);

    // 3. Grow Room Trees
    this.frontier = [];
    spineCells.forEach(cell => {
        const checkAndAdd = (dx: number, dy: number, dir: 'n'|'s'|'e'|'w') => {
            const nx = cell.x + dx;
            const ny = cell.y + dy;
            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && this.getCell(nx, ny)?.type === CellType.Wall) {
                this.frontier.push({parentX: cell.x, parentY: cell.y, dir, state: 'NewRoom'});
            }
        };
        checkAndAdd(0, -1, 'n');
        checkAndAdd(0, 1, 's');
        checkAndAdd(1, 0, 'e');
        checkAndAdd(-1, 0, 'w');
    });

    while (this.frontier.length > 0) {
        const idx = this.prng.nextInt(0, this.frontier.length - 1);
        const {parentX, parentY, dir} = this.frontier[idx]; 
        this.frontier.splice(idx, 1);
        if (this.prng.next() > 0.4) continue; 

        const attempts = [{ w: 2, h: 2 }, { w: 2, h: 1 }, { w: 1, h: 2 }, { w: 1, h: 1 }];
        let placed = false;
        for (const size of attempts) {
            const { w, h } = size;
            const alignments: {rx: number, ry: number}[] = [];
            if (dir === 'n') { for(let r = parentX - w + 1; r <= parentX; r++) alignments.push({rx: r, ry: parentY - h}); }
            else if (dir === 's') { for(let r = parentX - w + 1; r <= parentX; r++) alignments.push({rx: r, ry: parentY + 1}); }
            else if (dir === 'e') { for(let r = parentY - h + 1; r <= parentY; r++) alignments.push({rx: parentX + 1, ry: r}); }
            else if (dir === 'w') { for(let r = parentY - h + 1; r <= parentY; r++) alignments.push({rx: parentX - w, ry: r}); }

            this.prng.shuffle(alignments);
            for (const alignment of alignments) {
                if (!this.checkProposedRoomForCollisionsAndCycles(alignment.rx, alignment.ry, w, h, parentX, parentY)) {
                    this.placeRoom(alignment.rx, alignment.ry, w, h, parentX, parentY, dir);
                    placed = true;
                    break;
                }
            }
            if (placed) break;
        }
    } 
    
    // 5. Features
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

  private placeRoom(rx: number, ry: number, w: number, h: number, parentX: number, parentY: number, dir: 'n'|'e'|'s'|'w') {
      const roomId = `room-${rx}-${ry}`;
      for(let y=ry; y<ry+h; y++) {
          for(let x=rx; x<rx+w; x++) {
              this.setFloor(x, y);
              const cell = this.getCell(x, y);
              if (cell) cell.roomId = roomId;
              if (x < rx + w - 1) this.openWall(x, y, 'e');
              if (y < ry + h - 1) this.openWall(x, y, 's');
          }
      }
      this.placeDoor(parentX, parentY, dir);

      const possibleOutwardDirs: {dx: number, dy: number, k: 'n'|'e'|'s'|'w'}[] = [
          {dx:0, dy:-1, k:'n'}, {dx:0, dy:1, k:'s'}, {dx:1, dy:0, k:'e'}, {dx:-1, dy:0, k:'w'}
      ];
      const validDirs = possibleOutwardDirs.filter(d => {
          const oppositeDir = (d.k === 'n' && dir === 's') || (d.k === 's' && dir === 'n') || (d.k === 'w' && dir === 'e') || (d.k === 'e' && dir === 'w');
          return !oppositeDir;
      });
      for (let y = ry; y < ry + h; y++) {
          for (let x = rx; x < rx + w; x++) {
              for (const d of validDirs) {
                  const nx = x + d.dx; const ny = y + d.dy;
                  if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && this.getCell(nx, ny)?.type === CellType.Wall) {
                      if (this.prng.next() < 0.5) this.frontier.push({parentX: x, parentY: y, dir: d.k, state: 'NewRoom'});
                  }
              }
          }
      }
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
    let nx = x, ny = y;
    if (dir === 'n') ny--; else if (dir === 'e') nx++; else if (dir === 's') ny++; else if (dir === 'w') nx--;
    this.walls.delete(this.getBoundaryKey(x, y, nx, ny));
  }

  private placeDoor(x: number, y: number, dir: string) {
    const doorId = `door-${this.doors.length}`;
    let segment: Vector2[];
    let orientation: 'Horizontal' | 'Vertical';
    if (dir === 'n') { orientation = 'Horizontal'; segment = [{x, y}, {x, y: y-1}]; }
    else if (dir === 's') { orientation = 'Horizontal'; segment = [{x, y}, {x, y: y+1}]; }
    else if (dir === 'w') { orientation = 'Vertical'; segment = [{x, y}, {x: x-1, y}]; }
    else { orientation = 'Vertical'; segment = [{x, y}, {x: x+1, y}]; }
    
    this.openWall(x, y, dir as any);
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

  private checkProposedRoomForCollisionsAndCycles(rx: number, ry: number, w: number, h: number, parentX: number, parentY: number): boolean {
    if (rx < 0 || ry < 0 || rx + w > this.width || ry + h > this.height) return true;
    for (let y = ry; y < ry + h; y++) {
      for (let x = rx; x < rx + w; x++) {
        if (this.getCell(x, y)?.type === CellType.Floor) return true; 
        const neighbors = [{nx: x-1, ny: y}, {nx: x+1, ny: y}, {nx: x, ny: y-1}, {nx: x, ny: y+1}];
        for (const n of neighbors) {
            const neighborCell = this.getCell(n.nx, n.ny);
            if (neighborCell?.type === CellType.Floor && (n.nx !== parentX || n.ny !== parentY)) return true;
        }
      }
    }
    return false; 
  }

  private generateSkeleton(spineCells: {x: number, y: number}[]) {
    if (Math.min(this.width, this.height) < 12) { this.generateFishbone(spineCells); return; }
    if (this.prng.next() < 0.6) this.generateFishbone(spineCells); else this.generateCross(spineCells);
  }

  private generateFishbone(spineCells: {x: number, y: number}[]) {
    if (this.width >= this.height) this.generateHorizontalFishbone(spineCells); else this.generateVerticalFishbone(spineCells);
  }

  private generateHorizontalFishbone(spineCells: {x: number, y: number}[]) {
    const aortaY = Math.floor(this.height / 2) + this.prng.nextInt(-1, 1);
    for (let x = 1; x <= this.width - 2; x++) {
      this.setFloor(x, aortaY);
      const cell = this.getCell(x, aortaY);
      if (cell) cell.roomId = 'corridor-aorta-h';
      spineCells.push({ x, y: aortaY });
      if (x > 1) this.openWall(x - 1, aortaY, 'e');
    }
    for (let x = 3; x <= this.width - 4; x += 4) {
      if (this.prng.next() < 0.8) {
        const lenUp = this.prng.nextInt(2, Math.floor(this.height / 2) - 2);
        for (let y = 1; y <= lenUp; y++) {
          this.setFloor(x, aortaY - y);
          const cell = this.getCell(x, aortaY - y);
          if (cell) cell.roomId = `corridor-artery-up-${x}`;
          spineCells.push({ x, y: aortaY - y });
          if (y === 1) this.openWall(x, aortaY, 'n'); else this.openWall(x, aortaY - y + 1, 'n');
        }
        const lenDown = this.prng.nextInt(2, Math.floor(this.height / 2) - 2);
        for (let y = 1; y <= lenDown; y++) {
          this.setFloor(x, aortaY + y);
          const cell = this.getCell(x, aortaY + y);
          if (cell) cell.roomId = `corridor-artery-down-${x}`;
          spineCells.push({ x, y: aortaY + y });
          if (y === 1) this.openWall(x, aortaY, 's'); else this.openWall(x, aortaY + y - 1, 's');
        }
      }
    }
  }

  private generateVerticalFishbone(spineCells: {x: number, y: number}[]) {
    const aortaX = Math.floor(this.width / 2) + this.prng.nextInt(-1, 1);
    for (let y = 1; y <= this.height - 2; y++) {
      this.setFloor(aortaX, y);
      const cell = this.getCell(aortaX, y);
      if (cell) cell.roomId = 'corridor-aorta-v';
      spineCells.push({ x: aortaX, y });
      if (y > 1) this.openWall(aortaX, y - 1, 's');
    }
    for (let y = 3; y <= this.height - 4; y += 4) {
      if (this.prng.next() < 0.8) {
        const lenLeft = this.prng.nextInt(2, Math.floor(this.width / 2) - 2);
        for (let x = 1; x <= lenLeft; x++) {
          this.setFloor(aortaX - x, y);
          const cell = this.getCell(aortaX - x, y);
          if (cell) cell.roomId = `corridor-artery-left-${y}`;
          spineCells.push({ x: aortaX - x, y });
          if (x === 1) this.openWall(aortaX, y, 'w'); else this.openWall(aortaX - x + 1, y, 'w');
        }
        const lenRight = this.prng.nextInt(2, Math.floor(this.width / 2) - 2);
        for (let x = 1; x <= lenRight; x++) {
          this.setFloor(aortaX + x, y);
          const cell = this.getCell(aortaX + x, y);
          if (cell) cell.roomId = `corridor-artery-right-${y}`;
          spineCells.push({ x: aortaX + x, y });
          if (x === 1) this.openWall(aortaX, y, 'e'); else this.openWall(aortaX + x - 1, y, 'e');
        }
      }
    }
  }

  private generateCross(spineCells: {x: number, y: number}[]) {
    const midX = Math.floor(this.width / 2) + this.prng.nextInt(-1, 1);
    const midY = Math.floor(this.height / 2) + this.prng.nextInt(-1, 1);
    for (let x = 1; x < this.width - 1; x++) {
      this.setFloor(x, midY);
      const cell = this.getCell(x, midY);
      if (cell) cell.roomId = 'corridor-aorta-h';
      spineCells.push({ x, y: midY });
      if (x > 1) this.openWall(x - 1, midY, 'e');
    }
    for (let y = 1; y < this.height - 1; y++) {
      if (y === midY) continue;
      this.setFloor(midX, y);
      const cell = this.getCell(midX, y);
      if (cell) cell.roomId = 'corridor-aorta-v';
      spineCells.push({ x: midX, y });
      if (y === midY - 1) this.openWall(midX, y, 's'); else if (y === midY + 1) this.openWall(midX, y, 'n');
      else if (y < midY) this.openWall(midX, y, 's'); else this.openWall(midX, y, 'n');
    }
    for (let x = 2; x < this.width - 2; x += 4) {
      if (Math.abs(x - midX) < 3) continue; 
      if (this.prng.next() < 0.7) {
        const lenUp = this.prng.nextInt(2, Math.floor(this.height / 4) + 2);
        for (let y = 1; y <= lenUp; y++) {
          if (this.getCell(x, midY - y)?.type === CellType.Floor) break;
          this.setFloor(x, midY - y);
          const cell = this.getCell(x, midY - y);
          if (cell) cell.roomId = `corridor-artery-up-${x}`;
          spineCells.push({ x, y: midY - y });
          if (y === 1) this.openWall(x, midY, 'n'); else this.openWall(x, midY - y + 1, 'n');
        }
        const lenDown = this.prng.nextInt(2, Math.floor(this.height / 4) + 2);
        for (let y = 1; y <= lenDown; y++) {
          if (this.getCell(x, midY + y)?.type === CellType.Floor) break;
          this.setFloor(x, midY + y);
          const cell = this.getCell(x, midY + y);
          if (cell) cell.roomId = `corridor-artery-down-${x}`;
          spineCells.push({ x, y: midY + y });
          if (y === 1) this.openWall(x, midY, 's'); else this.openWall(x, midY + y - 1, 's');
        }
      }
    }
    for (let y = 2; y < this.height - 2; y += 4) {
      if (Math.abs(y - midY) < 3) continue;
      if (this.prng.next() < 0.7) {
        const lenLeft = this.prng.nextInt(2, Math.floor(this.width / 4) + 2);
        for (let x = 1; x <= lenLeft; x++) {
          if (this.getCell(midX - x, y)?.type === CellType.Floor) break;
          this.setFloor(midX - x, y);
          const cell = this.getCell(midX - x, y);
          if (cell) cell.roomId = `corridor-artery-left-${y}`;
          spineCells.push({ x: midX - x, y });
          if (x === 1) this.openWall(midX, y, 'w'); else this.openWall(midX - x + 1, y, 'w');
        }
        const lenRight = this.prng.nextInt(2, Math.floor(this.width / 4) + 2);
        for (let x = 1; x <= lenRight; x++) {
          if (this.getCell(midX + x, y)?.type === CellType.Floor) break;
          this.setFloor(midX + x, y);
          const cell = this.getCell(midX + x, y);
          if (cell) cell.roomId = `corridor-artery-right-${y}`;
          spineCells.push({ x: midX + x, y });
          if (x === 1) this.openWall(midX, y, 'e'); else this.openWall(midX + x - 1, y, 'e');
        }
      }
    }
  }
}