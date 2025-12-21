import { MapDefinition, CellType, Cell, Door, SpawnPoint, Objective, Vector2, ObjectiveDefinition } from '../../shared/types';
import { PRNG } from '../../shared/PRNG';
import { MapGenerator } from '../MapGenerator';

type CellDepth = {
    x: number;
    y: number;
    depth: number;
    parent?: Vector2;
};

export class DenseShipGenerator {
  private prng: PRNG;
  private width: number;
  private height: number;
  private cells: Cell[] = [];
  private doors: Door[] = [];
  private spawnPoints: SpawnPoint[] = [];
  private objectives: ObjectiveDefinition[] = [];
  private extraction?: Vector2;
  private cellDepths: Map<string, CellDepth> = new Map();

  constructor(seed: number, width: number, height: number) {
    this.prng = new PRNG(seed);
    this.width = width;
    this.height = height;
  }

  public generate(): MapDefinition {
    // 1. Initialize grid as Void
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cells.push({
          x, y,
          type: CellType.Wall,
          walls: { n: true, e: true, s: true, w: true }
        });
      }
    }

    // 2. Create Corridors (Depth 0)
    // Random horizontal or vertical main spine
    const isHorizontal = this.prng.next() > 0.5;
    const spineIdx = isHorizontal ? this.prng.nextInt(2, this.height - 3) : this.prng.nextInt(2, this.width - 3);
    
    if (isHorizontal) {
        for (let x = 0; x < this.width; x++) {
            this.setDepth(x, spineIdx, 0);
            if (x > 0) this.openWall(x - 1, spineIdx, 'e');
        }
    } else {
        for (let y = 0; y < this.height; y++) {
            this.setDepth(spineIdx, y, 0);
            if (y > 0) this.openWall(spineIdx, y - 1, 's');
        }
    }

    // 3. Recursive Growth (Depth 1+)
    // Grow from existing depth N to N+1
    let currentDepth = 0;
    const maxDepth = 4;
    
    while (currentDepth < maxDepth) {
        const parents = Array.from(this.cellDepths.values()).filter(cd => cd.depth === currentDepth);
        if (parents.length === 0) break;

        // Shuffle parents to grow randomly
        this.prng.shuffle(parents);

        parents.forEach(p => {
            const neighbors = this.getNeighbors(p.x, p.y).filter(n => !this.cellDepths.has(`${n.x},${n.y}`));
            neighbors.forEach(n => {
                // High probability to grow to reach >90% fill
                if (this.prng.next() < 0.95) {
                    this.setDepth(n.x, n.y, currentDepth + 1, { x: p.x, y: p.y });
                    // Open wall between parent and child
                    const dir = this.getDirection(p, n);
                    if (dir) {
                        // For Depth 1+ connecting to parent, use a Door with some probability, else open wall
                        if (this.prng.next() < 0.3) {
                            this.placeDoor(p.x, p.y, n.x, n.y);
                        } else {
                            this.openWall(p.x, p.y, dir);
                        }
                    }
                }
            });
        });
        currentDepth++;
    }

    // 4. Fill remaining voids to ensure >90% (if possible while maintaining tree)
    // Find any remaining walls and connect them to a neighbor
    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            if (!this.cellDepths.has(`${x},${y}`)) {
                const neighbors = this.getNeighbors(x, y).filter(n => this.cellDepths.has(`${n.x},${n.y}`));
                if (neighbors.length > 0) {
                    const p = neighbors[0]; // Connect to first visited neighbor
                    const cd = this.cellDepths.get(`${p.x},${p.y}`)!;
                    this.setDepth(x, y, cd.depth + 1, { x: p.x, y: p.y });
                    const dir = this.getDirection(p, {x,y});
                    if (dir) this.openWall(p.x, p.y, dir);
                }
            }
        }
    }

    // 5. Place Entities
    // Spawn at one end of spine
    const spineCells = Array.from(this.cellDepths.values()).filter(cd => cd.depth === 0);
    const spawnCell = spineCells[0];
    this.spawnPoints.push({ id: 'sp-1', pos: { x: spawnCell.x, y: spawnCell.y }, radius: 1 });
    
    // Extraction at furthest point from spawn
    let furthestCell = spawnCell;
    let maxDist = 0;
    this.cellDepths.forEach(cd => {
        const dist = Math.abs(cd.x - spawnCell.x) + Math.abs(cd.y - spawnCell.y);
        if (dist > maxDist) {
            maxDist = dist;
            furthestCell = cd;
        }
    });
    this.extraction = { x: furthestCell.x, y: furthestCell.y };

    // Objectives at medium depth
    const candidates = Array.from(this.cellDepths.values()).filter(cd => cd.depth >= 2);
    if (candidates.length > 0) {
        this.prng.shuffle(candidates);
        for (let i = 0; i < Math.min(2, candidates.length); i++) {
            this.objectives.push({
                id: `artifact-${i}`,
                kind: 'Recover',
                targetCell: { x: candidates[i].x, y: candidates[i].y }
            });
        }
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

  private setDepth(x: number, y: number, depth: number, parent?: Vector2) {
      const cell = this.getCell(x, y);
      if (cell) {
          cell.type = CellType.Floor;
          this.cellDepths.set(`${x},${y}`, { x, y, depth, parent });
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