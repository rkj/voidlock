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
    // Horizontal spine in the middle
    const spineY = Math.floor(this.height / 2);
    const spineStart = 2;
    const spineEnd = this.width - 3;

    const spineCells: {x: number, y: number}[] = [];

    for (let x = spineStart; x <= spineEnd; x++) {
        this.setFloor(x, spineY);
        spineCells.push({x, y: spineY});
        // Connect horizontal neighbors
        if (x > spineStart) {
            this.openWall(x-1, spineY, 'e');
        }
    }

    // 3. Grow Room Trees
    // Identify potential attachment points on the spine (North and South walls of spine cells)
    const frontier: {parentX: number, parentY: number, dir: 'n'|'s'}[] = [];
    
    spineCells.forEach(cell => {
        // Chance to spawn a branch
        if (this.prng.next() < 0.4) {
            frontier.push({parentX: cell.x, parentY: cell.y, dir: 'n'});
        }
        if (this.prng.next() < 0.4) {
            frontier.push({parentX: cell.x, parentY: cell.y, dir: 's'});
        }
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
        let rx = 0, ry = 0;
        
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

        // Check bounds and collision
        // Constraint: Must be fully void.
        // Constraint: "Use all available squares" -> Try to pack tight.
        // But we must maintain 1 cell buffer? 
        // No, if we want "Tree", adjacent rooms that share a wall BUT have no door are fine.
        // Walls block movement.
        // So we can pack tightly.
        // Check if any cell in prospective room is already Floor.
        
        let collision = false;
        if (rx < 0 || ry < 0 || rx + w > this.width || ry + h > this.height) {
            collision = true;
        } else {
            for(let y=ry; y<ry+h; y++) {
                for(let x=rx; x<rx+w; x++) {
                    if (this.getCell(x, y)?.type === CellType.Floor) {
                        collision = true;
                        break;
                    }
                }
                if (collision) break;
            }
        }

        if (!collision) {
            // Place Room
            for(let y=ry; y<ry+h; y++) {
                for(let x=rx; x<rx+w; x++) {
                    this.setFloor(x, y);
                    // Internal walls
                    if (x < rx+w-1) this.openWall(x, y, 'e');
                    if (y < ry+h-1) this.openWall(x, y, 's');
                }
            }

            // Connect to Parent (Door)
            // Connection is at (parentX, parentY) -> dir
            // If dir='n', connection is between (parentX, parentY) and (parentX, parentY-1).
            // (parentX, parentY-1) is inside the new room (guaranteed by alignment logic).
            this.placeDoor(parentX, parentY, dir);

            // Add new expansion points to frontier
            // For each cell in the new room, check adjacent directions.
            // Don't go back to parent (or any existing floor).
            // Actually, we just add ALL walls of the new room to frontier.
            // When we pop them, the collision check handles "already floor".
            
            for(let y=ry; y<ry+h; y++) {
                for(let x=rx; x<rx+w; x++) {
                    // Try all 4 dirs?
                    // Optimization: Only add dirs that point to Void?
                    // Yes.
                    const dirs: {dx: number, dy: number, k: 'n'|'e'|'s'|'w'}[] = [
                        {dx:0, dy:-1, k:'n'}, {dx:0, dy:1, k:'s'}, 
                        {dx:1, dy:0, k:'e'}, {dx:-1, dy:0, k:'w'}
                    ];
                    
                    dirs.forEach(d => {
                        const nx = x + d.dx;
                        const ny = y + d.dy;
                        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                            if (this.getCell(nx, ny)?.type === CellType.Wall) {
                                // Add to frontier with probability to control density?
                                // "Use all squares" -> High probability.
                                if (this.prng.next() < 0.7) {
                                    frontier.push({parentX: x, parentY: y, dir: d.k});
                                }
                            }
                        }
                    });
                }
            }
        }
    }

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
}
