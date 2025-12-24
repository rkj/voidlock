import { MapDefinition, CellType, Cell, Door, SpawnPoint, Objective, Vector2 } from '../../shared/types';
import { PRNG } from '../../shared/PRNG';
import { MapGenerator } from '../MapGenerator';

export class TreeShipGenerator {
  private prng: PRNG;
  private width: number;
  private height: number;
  private cells: Cell[] = [];
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

  public generate(spawnPointCount: number = 1): MapDefinition {
    // 1. Initialize Grid (Void)
    this.cells = Array(this.height * this.width).fill(null).map((_, i) => ({
      x: i % this.width,
      y: Math.floor(i / this.width),
      type: CellType.Wall,
      walls: { n: true, e: true, s: true, w: true }
    }));

    const spineCells: {x: number, y: number}[] = [];

    // 2. Main Skeleton (Acyclic Arteries)
    this.generateSkeleton(spineCells);

    // 3. Grow Room Trees
    this.frontier = [];
    spineCells.forEach(cell => {
        // Only add walls that lead to Void
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

        // Restrict growth to keep map sparse
        if (this.prng.next() > 0.4) continue; 

        const attempts = [
            { w: 2, h: 2 },
            { w: 2, h: 1 },
            { w: 1, h: 2 },
            { w: 1, h: 1 }
        ];

        let placed = false;

        for (const size of attempts) {
            const { w, h } = size;
            const alignments: {rx: number, ry: number}[] = [];

            if (dir === 'n') {
                const ry = parentY - h;
                const minRx = parentX - w + 1;
                const maxRx = parentX;
                for(let r = minRx; r <= maxRx; r++) alignments.push({rx: r, ry});
            } else if (dir === 's') {
                const ry = parentY + 1;
                const minRx = parentX - w + 1;
                const maxRx = parentX;
                for(let r = minRx; r <= maxRx; r++) alignments.push({rx: r, ry});
            } else if (dir === 'e') {
                const rx = parentX + 1;
                const minRy = parentY - h + 1;
                const maxRy = parentY;
                for(let r = minRy; r <= maxRy; r++) alignments.push({rx, ry: r});
            } else if (dir === 'w') {
                const rx = parentX - w;
                const minRy = parentY - h + 1;
                const maxRy = parentY;
                for(let r = minRy; r <= maxRy; r++) alignments.push({rx, ry: r});
            }

            this.prng.shuffle(alignments);

            for (const alignment of alignments) {
                const { rx, ry } = alignment;
                
                if (!this.checkProposedRoomForCollisionsAndCycles(rx, ry, w, h, parentX, parentY, dir as any)) {
                    this.placeRoom(rx, ry, w, h, parentX, parentY, dir as any);
                    placed = true;
                    break;
                }
            }
            if (placed) break;
        }
    } 
    
    // 5. Features
    this.placeFeatures(spawnPointCount);
    const map = {
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

  private placeRoom(rx: number, ry: number, w: number, h: number, parentX: number, parentY: number, dir: 'n'|'e'|'s'|'w') {
      const roomId = `room-${rx}-${ry}`;
      // Place Room
      for(let y=ry; y<ry+h; y++) {
          for(let x=rx; x<rx+w; x++) {
              this.setFloor(x, y);
              const cell = this.getCell(x, y);
              if (cell) cell.roomId = roomId;
              
              // Internal walls: Open connections to neighbors within the room
              const isLastCol = (x === rx + w - 1);
              const isLastRow = (y === ry + h - 1);

              if (!isLastCol) this.openWall(x, y, 'e');
              if (!isLastRow) this.openWall(x, y, 's');
          }
      }

      // Connect to Parent (Door)
      this.placeDoor(parentX, parentY, dir);

      // --- EXPAND FRONTIER ---
      const newRoomCells: {x: number, y: number}[] = [];
      for(let y = ry; y < ry + h; y++) {
          for(let x = rx; x < rx + w; x++) {
              newRoomCells.push({x, y});
          }
      }

      const possibleOutwardDirs: {dx: number, dy: number, k: 'n'|'e'|'s'|'w'}[] = [
          {dx:0, dy:-1, k:'n'}, {dx:0, dy:1, k:'s'}, 
          {dx:1, dy:0, k:'e'}, {dx:-1, dy:0, k:'w'}
      ];

      const validDirs = possibleOutwardDirs.filter(d => {
          // Exclude direction back to parent
          const oppositeDir = (d.k === 'n' && dir === 's') || (d.k === 's' && dir === 'n') ||
                            (d.k === 'w' && dir === 'e') || (d.k === 'e' && dir === 'w');
          return !oppositeDir;
      });

      for (const cell of newRoomCells) {
          for (const d of validDirs) {
              const nx = cell.x + d.dx;
              const ny = cell.y + d.dy;

              if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && this.getCell(nx, ny)?.type === CellType.Wall) {
                  if (this.prng.next() < 0.5) {
                      this.frontier.push({parentX: cell.x, parentY: cell.y, dir: d.k, state: 'NewRoom'});
                  }
              }
          }
      }
  }

  private setFloor(x: number, y: number) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.cells[y * this.width + x].type = CellType.Floor;
  }

  private getCell(x: number, y: number): Cell | undefined {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return undefined;
    return this.cells[y * this.width + x];
  }

  private openWall(x: number, y: number, dir: 'n'|'e'|'s'|'w') {
    const c1 = this.getCell(x, y);
    if (!c1) return;
    c1.walls[dir] = false;

    let x2 = x, y2 = y;
    let opp: 'n'|'e'|'s'|'w' = 's';
    if (dir === 'n') { y2--; opp = 's'; }
    if (dir === 'e') { x2++; opp = 'w'; }
    if (dir === 's') { y2++; opp = 'n'; }
    if (dir === 'w') { x2--; opp = 'e'; }

    const c2 = this.getCell(x2, y2);
    if (c2) c2.walls[opp] = false;
  }

  private placeDoor(x: number, y: number, dir: string) {
    const doorId = `door-${this.doors.length}`;
    let segment: Vector2[];
    let orientation: 'Horizontal' | 'Vertical';

    if (dir === 'n') { 
        orientation = 'Horizontal';
        segment = [{x, y}, {x, y: y-1}];
    } else if (dir === 's') { 
        orientation = 'Horizontal';
        segment = [{x, y}, {x, y: y+1}];
    } else if (dir === 'w') { 
        orientation = 'Vertical';
        segment = [{x, y}, {x: x-1, y}];
    } else { // 'e'
        orientation = 'Vertical';
        segment = [{x, y}, {x: x+1, y}];
    }

    this.doors.push({
        id: doorId,
        state: 'Closed',
        orientation,
        segment,
        hp: 50, maxHp: 50, openDuration: 1
    });
  }

  private placeFeatures(spawnPointCount: number) {
    const floors = this.cells.filter(c => c.type === CellType.Floor);
    if (floors.length === 0) return;

    const roomFloors = floors.filter(c => c.roomId && c.roomId.startsWith('room-'));
    // Fallback to all floors ONLY if no rooms exist (should not happen in TreeShip)
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
        this.objectives.push({
            id: 'obj-1',
            kind: 'Recover',
            targetCell: { x: objCell.x, y: objCell.y },
            state: 'Pending'
        });
    }
  }

  private checkProposedRoomForCollisionsAndCycles(
    rx: number, ry: number, w: number, h: number,
    parentX: number, parentY: number, dir: 'n'|'e'|'s'|'w'
  ): boolean {
    if (rx < 0 || ry < 0 || rx + w > this.width || ry + h > this.height) {
      return true;
    }

    for (let y = ry; y < ry + h; y++) {
      for (let x = rx; x < rx + w; x++) {
        if (this.getCell(x, y)?.type === CellType.Floor) {
          return true; 
        }

        const neighbors = [
            {nx: x-1, ny: y}, {nx: x+1, ny: y},
            {nx: x, ny: y-1}, {nx: x, ny: y+1}
        ];
        for (const n of neighbors) {
            const neighborCell = this.getCell(n.nx, n.ny);
            if (neighborCell?.type === CellType.Floor) {
                if (n.nx !== parentX || n.ny !== parentY) {
                    return true; 
                }
            }
        }
      }
    }
    return false; 
  }

  private generateSkeleton(spineCells: {x: number, y: number}[]) {
    if (Math.min(this.width, this.height) < 12) {
      this.generateFishbone(spineCells);
      return;
    }

    const roll = this.prng.next();
    if (roll < 0.6) {
      this.generateFishbone(spineCells);
    } else {
      this.generateCross(spineCells);
    }
  }

  private generateFishbone(spineCells: {x: number, y: number}[]) {
    if (this.width >= this.height) {
      this.generateHorizontalFishbone(spineCells);
    } else {
      this.generateVerticalFishbone(spineCells);
    }
  }

  private generateHorizontalFishbone(spineCells: {x: number, y: number}[]) {
    const aortaY = Math.floor(this.height / 2) + this.prng.nextInt(-1, 1);
    const aortaStart = 1;
    const aortaEnd = this.width - 2;

    for (let x = aortaStart; x <= aortaEnd; x++) {
      this.setFloor(x, aortaY);
      const cell = this.getCell(x, aortaY);
      if (cell) cell.roomId = 'corridor-aorta-h';
      spineCells.push({ x, y: aortaY });
      if (x > aortaStart) {
        this.openWall(x - 1, aortaY, 'e');
      }
    }

    const arteryInterval = 4;
    for (let x = aortaStart + 2; x <= aortaEnd - 2; x += arteryInterval) {
      if (this.prng.next() < 0.8) {
        const lenUp = this.prng.nextInt(2, Math.floor(this.height / 2) - 2);
        const arteryId = `corridor-artery-up-${x}`;
        for (let y = 1; y <= lenUp; y++) {
          const cy = aortaY - y;
          this.setFloor(x, cy);
          const cell = this.getCell(x, cy);
          if (cell) cell.roomId = arteryId;
          spineCells.push({ x, y: cy });
          if (y === 1) {
            this.openWall(x, aortaY, 'n');
          } else {
            this.openWall(x, cy + 1, 'n');
          }
        }
        const lenDown = this.prng.nextInt(2, Math.floor(this.height / 2) - 2);
        const arteryIdDown = `corridor-artery-down-${x}`;
        for (let y = 1; y <= lenDown; y++) {
          const cy = aortaY + y;
          this.setFloor(x, cy);
          const cell = this.getCell(x, cy);
          if (cell) cell.roomId = arteryIdDown;
          spineCells.push({ x, y: cy });
          if (y === 1) {
            this.openWall(x, aortaY, 's');
          } else {
            this.openWall(x, cy - 1, 's');
          }
        }
      }
    }
  }

  private generateVerticalFishbone(spineCells: {x: number, y: number}[]) {
    const aortaX = Math.floor(this.width / 2) + this.prng.nextInt(-1, 1);
    const aortaStart = 1;
    const aortaEnd = this.height - 2;

    for (let y = aortaStart; y <= aortaEnd; y++) {
      this.setFloor(aortaX, y);
      const cell = this.getCell(aortaX, y);
      if (cell) cell.roomId = 'corridor-aorta-v';
      spineCells.push({ x: aortaX, y });
      if (y > aortaStart) {
        this.openWall(aortaX, y - 1, 's');
      }
    }

    const arteryInterval = 4;
    for (let y = aortaStart + 2; y <= aortaEnd - 2; y += arteryInterval) {
      if (this.prng.next() < 0.8) {
        const lenLeft = this.prng.nextInt(2, Math.floor(this.width / 2) - 2);
        const arteryId = `corridor-artery-left-${y}`;
        for (let x = 1; x <= lenLeft; x++) {
          const cx = aortaX - x;
          this.setFloor(cx, y);
          const cell = this.getCell(cx, y);
          if (cell) cell.roomId = arteryId;
          spineCells.push({ x: cx, y });
          if (x === 1) {
            this.openWall(aortaX, y, 'w');
          } else {
            this.openWall(cx + 1, y, 'w');
          }
        }
        const lenRight = this.prng.nextInt(2, Math.floor(this.width / 2) - 2);
        const arteryIdRight = `corridor-artery-right-${y}`;
        for (let x = 1; x <= lenRight; x++) {
          const cx = aortaX + x;
          this.setFloor(cx, y);
          const cell = this.getCell(cx, y);
          if (cell) cell.roomId = arteryIdRight;
          spineCells.push({ x: cx, y });
          if (x === 1) {
            this.openWall(aortaX, y, 'e');
          } else {
            this.openWall(cx - 1, y, 'e');
          }
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
      if (x > 1) {
        this.openWall(x - 1, midY, 'e');
      }
    }

    for (let y = 1; y < this.height - 1; y++) {
      if (y === midY) continue;
      this.setFloor(midX, y);
      const cell = this.getCell(midX, y);
      if (cell) cell.roomId = 'corridor-aorta-v';
      spineCells.push({ x: midX, y });
      if (y === midY - 1) {
        this.openWall(midX, y, 's');
      } else if (y === midY + 1) {
        this.openWall(midX, y, 'n');
      } else if (y < midY) {
        this.openWall(midX, y, 's');
      } else {
        this.openWall(midX, y, 'n');
      }
    }

    const arteryInterval = 4;
    for (let x = 2; x < this.width - 2; x += arteryInterval) {
      if (Math.abs(x - midX) < 3) continue; 
      if (this.prng.next() < 0.7) {
        const lenUp = this.prng.nextInt(2, Math.floor(this.height / 4) + 2);
        const arteryId = `corridor-artery-up-${x}`;
        for (let y = 1; y <= lenUp; y++) {
          const cy = midY - y;
          if (this.getCell(x, cy)?.type === CellType.Floor) break;
          this.setFloor(x, cy);
          const cell = this.getCell(x, cy);
          if (cell) cell.roomId = arteryId;
          spineCells.push({ x, y: cy });
          if (y === 1) {
            this.openWall(x, midY, 'n');
          } else {
            this.openWall(x, cy + 1, 'n');
          }
        }
        const lenDown = this.prng.nextInt(2, Math.floor(this.height / 4) + 2);
        const arteryIdDown = `corridor-artery-down-${x}`;
        for (let y = 1; y <= lenDown; y++) {
          const cy = midY + y;
          if (this.getCell(x, cy)?.type === CellType.Floor) break;
          this.setFloor(x, cy);
          const cell = this.getCell(x, cy);
          if (cell) cell.roomId = arteryIdDown;
          spineCells.push({ x, y: cy });
          if (y === 1) {
            this.openWall(x, midY, 's');
          } else {
            this.openWall(x, cy - 1, 's');
          }
        }
      }
    }

    for (let y = 2; y < this.height - 2; y += arteryInterval) {
      if (Math.abs(y - midY) < 3) continue;
      if (this.prng.next() < 0.7) {
        const lenLeft = this.prng.nextInt(2, Math.floor(this.width / 4) + 2);
        const arteryId = `corridor-artery-left-${y}`;
        for (let x = 1; x <= lenLeft; x++) {
          const cx = midX - x;
          if (this.getCell(cx, y)?.type === CellType.Floor) break;
          this.setFloor(cx, y);
          const cell = this.getCell(cx, y);
          if (cell) cell.roomId = arteryId;
          spineCells.push({ x: cx, y });
          if (x === 1) {
            this.openWall(midX, y, 'w');
          } else {
            this.openWall(cx + 1, y, 'w');
          }
        }
        const lenRight = this.prng.nextInt(2, Math.floor(this.width / 4) + 2);
        const arteryIdRight = `corridor-artery-right-${y}`;
        for (let x = 1; x <= lenRight; x++) {
          const cx = midX + x;
          if (this.getCell(cx, y)?.type === CellType.Floor) break;
          this.setFloor(cx, y);
          const cell = this.getCell(cx, y);
          if (cell) cell.roomId = arteryIdRight;
          spineCells.push({ x: cx, y });
          if (x === 1) {
            this.openWall(midX, y, 'e');
          } else {
            this.openWall(cx - 1, y, 'e');
          }
        }
      }
    }
  }
}