import { MapDefinition, CellType, Cell, Door, SpawnPoint, Objective } from '../../shared/types';
import { PRNG } from '../../shared/PRNG';

export class TreeShipGenerator {
  private prng: PRNG;
  private width: number;
  private height: number;
  private cells: Cell[] = [];
  private doors: Door[] = [];
  private spawnPoints: SpawnPoint[] = [];
  private objectives: Objective[] = [];
  private extraction?: { x: number, y: number };
  private frontier: {parentX: number, parentY: number, dir: 'n'|'s'|'e'|'w'}[] = [];

  constructor(seed: number, width: number, height: number) {
    this.prng = new PRNG(seed);
    this.width = width;
    this.height = height;
  }

  public generate(): MapDefinition {
    // 1. Initialize Grid (Void)
    this.cells = Array(this.height * this.width).fill(null).map((_, i) => ({
      x: i % this.width,
      y: Math.floor(i / this.width),
      type: CellType.Wall,
      walls: { n: true, e: true, s: true, w: true }
    }));

    const spineCells: {x: number, y: number}[] = [];

    // 2. Main Skeleton (Branching Arteries / Fishbone)
    // Strategy:
    // - Create a primary horizontal spine (Aorta)
    // - Create secondary vertical spines (Arteries) branching off the Aorta at intervals
    // - Ensure spines do not touch each other except at the branch point (to keep tree structure)
    // - Corridors are 1-tile wide.

    const aortaY = Math.floor(this.height / 2); // Center Y
    const aortaStart = 1;
    const aortaEnd = this.width - 2;

    // Draw Aorta
    for (let x = aortaStart; x <= aortaEnd; x++) {
        this.setFloor(x, aortaY);
        spineCells.push({x, y: aortaY});
        if (x > aortaStart) this.openWall(x-1, aortaY, 'e');
    }

    // Draw Arteries (Vertical branches off Aorta)
    // Spaced out to avoid crowding
    const arteryInterval = 4; // Every 4 tiles?
    // Randomize slightly?
    
    for (let x = aortaStart + 2; x <= aortaEnd - 2; x += arteryInterval) {
        // Chance to spawn artery
        if (this.prng.next() < 0.8) {
            // Upward Artery
            const lenUp = this.prng.nextInt(2, Math.floor(this.height/2) - 2);
            for (let y = 1; y <= lenUp; y++) {
                const cy = aortaY - y;
                this.setFloor(x, cy);
                spineCells.push({x, y: cy});
                if (y === 1) this.openWall(x, aortaY, 'n'); // Connect to Aorta
                else this.openWall(x, cy + 1, 'n'); // Connect to previous segment
            }

            // Downward Artery
            const lenDown = this.prng.nextInt(2, Math.floor(this.height/2) - 2);
            for (let y = 1; y <= lenDown; y++) {
                const cy = aortaY + y;
                this.setFloor(x, cy);
                spineCells.push({x, y: cy});
                if (y === 1) this.openWall(x, aortaY, 's'); // Connect to Aorta
                else this.openWall(x, cy - 1, 's'); // Connect to previous segment
            }
        }
    }

    // 3. Grow Room Trees
    // Add all spine walls to frontier to allow room growth
    this.frontier = [];
    spineCells.forEach(cell => {
        // Only add walls that lead to Void
        const checkAndAdd = (dx: number, dy: number, dir: 'n'|'s'|'e'|'w') => {
            const nx = cell.x + dx;
            const ny = cell.y + dy;
            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && this.getCell(nx, ny)?.type === CellType.Wall) {
                this.frontier.push({parentX: cell.x, parentY: cell.y, dir});
            }
        };
        checkAndAdd(0, -1, 'n');
        checkAndAdd(0, 1, 's');
        checkAndAdd(1, 0, 'e');
        checkAndAdd(-1, 0, 'w');
    });

    while (this.frontier.length > 0) {
        // Pick random (Strategy: Random usually good for organic growth. Stack (DFS) for long corridors.)
        const idx = this.prng.nextInt(0, this.frontier.length - 1);
        const {parentX, parentY, dir} = this.frontier[idx];
        this.frontier.splice(idx, 1);

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
    
    // 4. Fill Gaps
    // Iterate through the grid and try to fill small voids (e.g. 1x1 holes) if they connect to valid floor.
    // This improves density without breaking the tree structure (since we verify no cycles).
    
    for (let y = 1; y < this.height - 1; y++) {
        for (let x = 1; x < this.width - 1; x++) {
            if (this.getCell(x, y)?.type === CellType.Wall) {
                // Check neighbors
                const neighbors = [
                    { nx: x, ny: y - 1, dir: 'n' }, { nx: x, ny: y + 1, dir: 's' },
                    { nx: x + 1, ny: y, dir: 'e' }, { nx: x - 1, ny: y, dir: 'w' }
                ];
                
                // Shuffle neighbors to avoid bias
                this.prng.shuffle(neighbors);

                for (const n of neighbors) {
                    const neighborCell = this.getCell(n.nx, n.ny);
                    if (neighborCell?.type === CellType.Floor) {
                        // Found a floor neighbor. Can we attach?
                        // Treat as a 1x1 room attempt from neighbor.
                        // Parent is (nx, ny). New room is (x, y).
                        // Direction from Parent to New is opposite of n.dir?
                        // Wait, n.dir is direction of neighbor relative to current cell.
                        // So if neighbor is North (y-1), direction from neighbor to current is South.
                        
                        let dirFromParent: 'n'|'s'|'e'|'w' = 's';
                        if (n.dir === 'n') dirFromParent = 's';
                        else if (n.dir === 's') dirFromParent = 'n';
                        else if (n.dir === 'e') dirFromParent = 'w';
                        else if (n.dir === 'w') dirFromParent = 'e';

                        if (!this.checkProposedRoomForCollisionsAndCycles(x, y, 1, 1, n.nx, n.ny, dirFromParent)) {
                            this.placeRoom(x, y, 1, 1, n.nx, n.ny, dirFromParent);
                            break; // Filled this cell, move to next
                        }
                    }
                }
            }
        }
    }

    // 5. Features
    this.placeFeatures();
    return {
        width: this.width,
        height: this.height,
        cells: this.cells,
        doors: this.doors,
        spawnPoints: this.spawnPoints,
        extraction: this.extraction,
        objectives: this.objectives
    };
  }

  private placeRoom(rx: number, ry: number, w: number, h: number, parentX: number, parentY: number, dir: 'n'|'e'|'s'|'w') {
      // Place Room
      for(let y=ry; y<ry+h; y++) {
          for(let x=rx; x<rx+w; x++) {
              this.setFloor(x, y);
              
              // Internal walls (Comb strategy for acyclicity)
              const isFirstRow = (y === ry);
              const isLastRow = (y === ry + h - 1);
              const isLastCol = (x === rx + w - 1);

              if (isFirstRow && !isLastCol) this.openWall(x, y, 'e');
              if (!isLastRow) this.openWall(x, y, 's');
          }
      }

      // Connect to Parent (Door)
      this.placeDoor(parentX, parentY, dir);
      this.openWall(parentX, parentY, dir);

      // --- EXPAND FRONTIER ---
      // Add walls of the new room to frontier
      
      // Determine cells of the new room
      const newRoomCells: {x: number, y: number}[] = [];
      for(let y = ry; y < ry + h; y++) {
          for(let x = rx; x < rx + w; x++) {
              newRoomCells.push({x, y});
          }
      }

      // Potential directions for new branches
      const possibleOutwardDirs: {dx: number, dy: number, k: 'n'|'e'|'s'|'w'}[] = [
          {dx:0, dy:-1, k:'n'}, {dx:0, dy:1, k:'s'}, 
          {dx:1, dy:0, k:'e'}, {dx:-1, dy:0, k:'w'}
      ].filter(d => {
          // Exclude direction back to parent
          const oppositeDir = (d.k === 'n' && dir === 's') || (d.k === 's' && dir === 'n') ||
                            (d.k === 'w' && dir === 'e') || (d.k === 'e' && dir === 'w');
          return !oppositeDir;
      });

      for (const cell of newRoomCells) {
          for (const d of possibleOutwardDirs) {
              const nx = cell.x + d.dx;
              const ny = cell.y + d.dy;

              // If target is valid wall
              if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && this.getCell(nx, ny)?.type === CellType.Wall) {
                  this.frontier.push({parentX: cell.x, parentY: cell.y, dir: d.k});
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

      // Door segment should contain the two cells it connects.
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

  private placeFeatures() {
      const floors = this.cells.filter(c => c.type === CellType.Floor);
      if (floors.length === 0) return;

      const leftMost = floors.sort((a,b) => a.x - b.x)[0];
      this.spawnPoints.push({ id: 'spawn-1', pos: { x: leftMost.x, y: leftMost.y }, radius: 1 });

      const rightMost = floors.sort((a,b) => b.x - a.x)[0];
      this.extraction = { x: rightMost.x, y: rightMost.y };

      const validObjective = floors.filter(c => Math.abs(c.x - leftMost.x) > 5);
      if (validObjective.length > 0) {
          const objCell = validObjective[this.prng.nextInt(0, validObjective.length - 1)];
          this.objectives.push({
              id: 'obj-1',
              kind: 'Recover',
              targetCell: { x: objCell.x, y: objCell.y },
              state: 'Pending'
          });
      }
  }

  /**
   * Checks if a proposed room placement would cause collisions (overlap existing floor) or cycles.
   */
  private checkProposedRoomForCollisionsAndCycles(
    rx: number, ry: number, w: number, h: number,
    parentX: number, parentY: number, dir: 'n'|'e'|'s'|'w'
  ): boolean {
    // 1. Check bounds
    if (rx < 0 || ry < 0 || rx + w > this.width || ry + h > this.height) {
      return true;
    }

    // Define the cell that will connect to the parent (the door cell within the new room)
    let connectionRoomCellX = -1, connectionRoomCellY = -1;
    if (dir === 'n') { connectionRoomCellX = parentX; connectionRoomCellY = parentY - 1; }
    else if (dir === 's') { connectionRoomCellX = parentX; connectionRoomCellY = parentY + 1; }
    else if (dir === 'e') { connectionRoomCellX = parentX + 1; connectionRoomCellY = parentY; }
    else if (dir === 'w') { connectionRoomCellX = parentX - 1; connectionRoomCellY = parentY; }

    // Helper to identify if a wall segment is the one connecting to the parent
    const isParentConnection = (
      currX: number, currY: number, neighborX: number, neighborY: number
    ): boolean => {
      // Check if (currX, currY) is the designated connectionRoomCell AND (neighborX, neighborY) is the parent
      return (currX === connectionRoomCellX && currY === connectionRoomCellY &&
              neighborX === parentX && neighborY === parentY);
    };

    // 2. Check for overlap with existing Floor cells
    // Note: We used to check for adjacency to prevent cycles, but strict acyclicity 
    // is enforced by only opening walls to the parent. Adjacency without open walls
    // does not create a graph cycle. Allowing adjacency allows for much higher density.
    for (let y = ry; y < ry + h; y++) {
      for (let x = rx; x < rx + w; x++) {
        // Check if any cell in the proposed room is ALREADY a Floor cell (overlap)
        if (this.getCell(x, y)?.type === CellType.Floor) {
          return true; // Overlap collision
        }
      }
    }
    return false; // No collision detected
  }
}