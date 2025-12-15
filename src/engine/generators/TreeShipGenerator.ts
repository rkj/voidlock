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

    // 2. Main Corridor (Spine)
    // Horizontal spine at a random Y position, with a small thickness
    const spineY = this.prng.nextInt(1, this.height - 2); // Avoid edges
    const spineStart = 0; // Start from edge
    const spineEnd = this.width - 1; // End at edge

    const spineCells: {x: number, y: number}[] = [];

    for (let x = spineStart; x <= spineEnd; x++) {
        this.setFloor(x, spineY);
        spineCells.push({x, y: spineY});
        // Connect horizontal neighbors
        if (x > spineStart) {
            this.openWall(x-1, spineY, 'e');
        }

        // Also make adjacent cells part of the spine, with a probability
        const expandNorth = this.prng.next() < 0.5; // Consume PRNG
        const expandSouth = this.prng.next() < 0.5; // Consume PRNG

        if (expandNorth) {
            if (spineY > 0) {
              this.setFloor(x, spineY - 1);
              spineCells.push({x, y: spineY - 1}); // Add to spineCells
              this.openWall(x, spineY, 'n'); // Open wall between spineY and spineY-1
            }
        }
        if (expandSouth) {
            if (spineY < this.height - 1) {
              this.setFloor(x, spineY + 1);
              spineCells.push({x, y: spineY + 1}); // Add to spineCells
              this.openWall(x, spineY, 's'); // Open wall between spineY and spineY+1
            }
        }
    }

    // 3. Grow Room Trees
    // Identify potential attachment points on the spine (North and South walls of spine cells)
    const frontier: {parentX: number, parentY: number, dir: 'n'|'s'}[] = [];
    
    spineCells.forEach(cell => {
        // Guarantee to spawn a branch from each cell of the spine
        frontier.push({parentX: cell.x, parentY: cell.y, dir: 'n'});
        frontier.push({parentX: cell.x, parentY: cell.y, dir: 's'});
    });

    // We process frontier. Each step creates a room and adds its other walls to frontier.
    // To prevent loops, we NEVER connect to an existing floor. We only expand into Void.
    // "Tree structure": Single parent.
    
    // Shuffle frontier to grow randomly? Or BFS?
    // Let's shuffle.
    // Actually, simple array is fine, but maybe prioritize depth?
    
    while (frontier.length > 0) {
        // Pick random
        const idx = this.prng.nextInt(0, frontier.length - 1);
        const {parentX, parentY, dir} = frontier[idx];
        frontier.splice(idx, 1);

        // Determine room size (Max 2x2)
        const w = this.prng.nextInt(1, 2);
        const h = this.prng.nextInt(1, 2);

        // Determine origin relative to parent/dir
        let rx = 0, ry = 0; // rx and ry are initialized here and used throughout this loop iteration.
        
        // We want the room to be adjacent to parent in direction `dir`.
        // Parent is at (parentX, parentY).
        // If dir='n', room bottom row should touch parentY.
        //   parent is (px, py). Room bottom edge is at py.
        //   Room y range: [py - h, py - 1].
        //   Room x range: needs to overlap px.
        //   Let's pick random x-offset such that it touches.
        
        if (dir === 'n') {
            ry = parentY - h;
            // rx such that [rx, rx+w-1] overlaps parentX.
            // i.e. rx <= parentX and rx+w > parentX
            const minRx = parentX - w + 1;
            const maxRx = parentX;
            rx = this.prng.nextInt(minRx, maxRx);
        } else if (dir === 's') {
            ry = parentY + 1;
            const minRx = parentX - w + 1;
            const maxRx = parentX;
            rx = this.prng.nextInt(minRx, maxRx);
        } else if (dir === 'e') {
            rx = parentX + 1;
            const minRy = parentY - h + 1;
            const maxRy = parentY;
            ry = this.prng.nextInt(minRy, maxRy);
        } else if (dir === 'w') {
            rx = parentX - w;
            const minRy = parentY - h + 1;
            const maxRy = parentY;
            ry = this.prng.nextInt(minRy, maxRy);
        }

        // --- NEW COLLISION AND CYCLE CHECK ---
        if (this.checkProposedRoomForCollisionsAndCycles(rx, ry, w, h, parentX, parentY, dir)) {
            continue; // Skip this frontier point if it would cause collision or cycle
        }

        // Place Room
        for(let y=ry; y<ry+h; y++) {
            for(let x=rx; x<rx+w; x++) {
                this.setFloor(x, y);
                // Internal walls - ensure internal walls are only opened if both sides are within the new room
                if (x < rx+w-1) this.openWall(x, y, 'e');
                if (y < ry+h-1) this.openWall(x, y, 's');
            }
        }

        // Connect to Parent (Door)
        this.placeDoor(parentX, parentY, dir);

        // --- REVISED FRONTIER EXPANSION (Stricter) ---
        // New room is placed at (rx, ry) with size (w, h).
        // It's connected to (parentX, parentY) in 'dir'.

        const newRoomCells: {dx: number, dy: number, k: 'n'|'e'|'s'|'w'}[] = [];
        for(let y = ry; y < ry + h; y++) {
            for(let x = rx; x < rx + w; x++) {
                newRoomCells.push({x, y});
            }
        }

        // Potential directions for new branches, excluding the direction back to the parent
        const possibleOutwardDirs: {dx: number, dy: number, k: 'n'|'e'|'s'|'w'}[] = [
            {dx:0, dy:-1, k:'n'}, {dx:0, dy:1, k:'s'}, 
            {dx:1, dy:0, k:'e'}, {dx:-1, dy:0, k:'w'}
        ].filter(d => {
            // Convert 'dir' to its opposite to identify the direction back to parent
            const oppositeDir = (d.k === 'n' && dir === 's') || (d.k === 's' && dir === 'n') ||
                              (d.k === 'w' && dir === 'e') || (d.k === 'e' && dir === 'w');
            return !oppositeDir;
        });

        // Try to add up to 1 new branch from the new room, further extending the tree.
        // This ensures maximum 2 doors per room (1 to parent, 1 to child).
        if (this.prng.next() < 1.0) { // Probability to create a new branch - Guaranteed expansion (if valid)
            this.prng.shuffle(newRoomCells); // Pick a random cell from the new room
            this.prng.shuffle(possibleOutwardDirs); // Pick a random outward direction

            let branchesAdded = 0; // Initialize branchesAdded
            for (const cell of newRoomCells) {
                if (branchesAdded >= 2) break; // If 2 branches were added, stop looking for more from other cells
                for (const d of possibleOutwardDirs) {
                    const nx = cell.x + d.dx;
                    const ny = cell.y + d.dy;

                    // Check if the target cell (nx, ny) is within bounds and is currently a Wall
                    if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && this.getCell(nx, ny)?.type === CellType.Wall) {
                        // Critical check: Ensure this potential branch point (nx,ny) does not immediately
                        // connect to another existing Floor cell (other than the current new room itself).
                        let isAdjacentToExistingFloor = false;
                        const neighborsOfProspectiveFrontier = [
                            { cx: nx, cy: ny - 1 }, { cx: nx, cy: ny + 1 },
                            { cx: nx - 1, cy: ny }, { cx: nx + 1, cy: ny }
                        ];

                        for (const nfp of neighborsOfProspectiveFrontier) {
                            const adjacentCell = this.getCell(nfp.cx, nfp.cy);
                            // If neighbor is a Floor cell, and it's not one of the cells from the *newly placed room*,
                            // then adding this frontier point would form an immediate cycle.
                            let isPartOfNewRoom = false;
                            for(let y_r = ry; y_r < ry + h; y_r++) {
                                for(let x_r = rx; x_r < rx + w; x_r++) {
                                    if (nfp.cx === x_r && nfp.cy === y_r) {
                                        isPartOfNewRoom = true;
                                        break;
                                    }
                                }
                                if (isPartOfNewRoom) break;
                            }

                            if (adjacentCell?.type === CellType.Floor && !isPartOfNewRoom) {
                                isAdjacentToExistingFloor = true;
                                break;
                            }
                        }

                        if (!isAdjacentToExistingFloor) {
                            frontier.push({parentX: cell.x, parentY: cell.y, dir: d.k});
                            branchesAdded++; // Increment when a branch is added
                            if (branchesAdded >= 2) break; // Break from 'd' loop if 2 branches added
                        }
                    }
                }
                if (branchesAdded >= 2) break; // If 2 branches were added, stop looking for more from other cells
            }
        }
    } // CLOSING BRACE FOR THE WHILE LOOP
    
    // 4. Features
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
          segment = [{x, y: y-1}, {x, y}];
      } else if (dir === 's') { 
          orientation = 'Horizontal';
          segment = [{x, y}, {x, y: y+1}];
      } else if (dir === 'w') { 
          orientation = 'Vertical';
          segment = [{x: x-1, y}, {x, y}];
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
   * @param rx Proposed room's top-left x
   * @param ry Proposed room's top-left y
   * @param w Proposed room's width
   * @param h Proposed room's height
   * @param parentX X-coordinate of the parent cell
   * @param parentY Y-coordinate of the parent cell
   * @param dir Direction from parent to the new room ('n'|'e'|'s'|'w')
   * @returns true if collision or cycle, false otherwise
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

    // 2. Check for overlap with existing Floor cells and accidental cycle creation
    for (let y = ry; y < ry + h; y++) {
      for (let x = rx; x < rx + w; x++) {
        // Check if any cell in the proposed room is ALREADY a Floor cell (overlap)
        if (this.getCell(x, y)?.type === CellType.Floor) {
          return true; // Overlap collision
        }

        // Check neighbors of the proposed room cells for existing Floor cells
        // (to prevent forming cycles through unintended connections)
        const neighbors = [
          { nx: x, ny: y - 1 }, { nx: x, ny: y + 1 },
          { nx: x - 1, ny: y }, { nx: x + 1, ny: y }
        ];

        for (const neighbor of neighbors) {
          const neighborCell = this.getCell(neighbor.nx, neighbor.ny);
          if (neighborCell?.type === CellType.Floor) {
            // Found an existing Floor cell adjacent to a proposed room cell.
            // This is ONLY allowed if it's the designated parent connection point.
            if (!isParentConnection(x, y, neighbor.nx, neighbor.ny)) {
              return true; // Cycle would form
            }
          }
        }
      }
    }
    return false; // No collision or cycle detected
  } // Missing closing brace for the class
}
