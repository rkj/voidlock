import { MapDefinition, CellType, Cell, Door, SpawnPoint, Objective } from '../../shared/types';
import { PRNG } from '../../shared/PRNG';

export class SpaceshipGenerator {
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

    // 2. Main Corridor (Horizontal Spine)
    const spineY = Math.floor(this.height / 2);
    // Span most of the width, with some padding
    const spineStart = 2;
    const spineEnd = this.width - 3;
    
    for (let x = spineStart; x <= spineEnd; x++) {
        this.setFloor(x, spineY);
        // Connect cells
        if (x > spineStart) this.openWall(x-1, spineY, 'e');
    }

    // 3. Branch Corridors (Vertical)
    const numBranches = this.prng.nextInt(2, 4);
    const branchXPositions: number[] = [];
    const minBranchDist = 4;
    
    for (let i = 0; i < numBranches; i++) {
        // Try to find a valid X
        for (let attempt = 0; attempt < 10; attempt++) {
            const bx = this.prng.nextInt(spineStart + 2, spineEnd - 2);
            if (!branchXPositions.some(x => Math.abs(x - bx) < minBranchDist)) {
                branchXPositions.push(bx);
                this.digBranch(bx, spineY);
                break;
            }
        }
    }

    // 4. Place Rooms
    // Try to place rooms along corridors
    const corridorCells = this.cells.filter(c => c.type === CellType.Floor);
    corridorCells.forEach(cell => {
        // Chance to spawn room adjacent to corridor
        if (this.prng.next() < 0.3) {
            this.tryPlaceRoom(cell.x, cell.y);
        }
    });

    // 5. Place Features
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

  private digBranch(startX: number, startY: number) {
      const lenNorth = this.prng.nextInt(3, Math.floor(this.height/2) - 2);
      const lenSouth = this.prng.nextInt(3, Math.floor(this.height/2) - 2);

      // Dig North
      for (let y = startY - 1; y >= startY - lenNorth; y--) {
          this.setFloor(startX, y);
          this.openWall(startX, y + 1, 'n');
      }
      
      // Dig South
      for (let y = startY + 1; y <= startY + lenSouth; y++) {
          this.setFloor(startX, y);
          this.openWall(startX, y - 1, 's');
      }
  }

  private tryPlaceRoom(cx: number, cy: number) {
      const w = this.prng.nextInt(3, 5);
      const h = this.prng.nextInt(3, 5);
      
      // Try directions
      const dirs = [{dx:0, dy:-1}, {dx:0, dy:1}, {dx:1, dy:0}, {dx:-1, dy:0}];
      const dir = dirs[this.prng.nextInt(0, 3)]; // Pick random direction from corridor

      // Calculate potential room origin (top-left) based on direction from corridor cell
      // Ideally room is centered on the connection point or flush
      // Let's simple try to place it so one edge touches (cx, cy)
      
      let rx = cx + dir.dx;
      let ry = cy + dir.dy;
      
      // Adjust to be top-left
      if (dir.dx === 1) { // Room to East
          // rx is left edge. Shift y to center room relative to corridor y if possible
          ry -= Math.floor(h/2);
      } else if (dir.dx === -1) { // Room to West
          rx -= w; 
          ry -= Math.floor(h/2);
      } else if (dir.dy === 1) { // Room to South
          rx -= Math.floor(w/2);
          // ry is top edge
      } else if (dir.dy === -1) { // Room to North
          rx -= Math.floor(w/2);
          ry -= h;
      }

      // Check bounds and collisions
      if (rx < 1 || ry < 1 || rx + w >= this.width - 1 || ry + h >= this.height - 1) return;

      // Check collision with existing floors
      for(let y=ry; y<ry+h; y++) {
          for(let x=rx; x<rx+w; x++) {
              if (this.getCell(x, y)?.type === CellType.Floor) return; // Collision
          }
      }

      // Dig Room
      for(let y=ry; y<ry+h; y++) {
          for(let x=rx; x<rx+w; x++) {
              this.setFloor(x, y);
              // Open internal walls
              if (x < rx+w-1) this.openWall(x, y, 'e');
              if (y < ry+h-1) this.openWall(x, y, 's');
          }
      }

      // Create Door to Corridor
      // The connection is between (cx, cy) and (cx+dir.dx, cy+dir.dy)
      const doorId = `door-${this.doors.length}`;
      // Determine door segment
      // CoreEngine assumes segments are Vector2[].
      // MapGenerator/GameGrid assumes wall logic.
      // We need to 'open' the wall logic BUT place a Door entity.
      // GameGrid.canMove checks doors first. So we DON'T need to set walls to false?
      // Actually, if we set walls to false, it's an open passage.
      // If we keep walls true, units can't pass UNLESS there is a door.
      // Correct: Keep walls CLOSED, place Door entity.
      
      // Wait, my `openWall` helper sets walls to false.
      // I should verify GameGrid logic.
      /*
        const door = getDoorAtSegment(...);
        if (door) return door.state === 'Open';
        // If no door, check walls...
      */
      // So if I place a door, I must ensure walls are physically closed in data if I want the door to control access.
      // But typically a door is placed IN an opening.
      // If the wall data says "Solid Wall", does the door override it?
      // `GameGrid.canMove`:
      // `if (door) return door.state === 'Open' ...`
      // `// If no door, check walls`
      // So yes, Door overrides Wall.
      // So I can leave the wall as `true` (solid) and place a Door.
      
      let segment: Vector2[];
      let orientation: 'Horizontal' | 'Vertical';
      
      if (dir.dy === 0) { // Horizontal connection (East/West) -> Vertical Door
          orientation = 'Vertical';
          // Connection between (cx, cy) and (cx+dx, cy)
          // If dx=1 (East), door is between x and x+1. Segment is vertical line at right of x.
          // Segment logic in types: `segment: Vector2[]`. Usually pair of cells adjacent to barrier.
          // In CoreEngine: `getAdjacentCellsToDoor` checks `segment` cells.
          // In `GameGrid`: `getDoorAtSegment` checks if `door.segment` contains the cell we are moving from/to?
          // Let's re-read `GameGrid.ts`.
          /*
            if (door.orientation === 'Vertical' && door.segment.some(sCell => sCell.x === cellInSegment.x && sCell.y === cellInSegment.y))
            ...
            if vertical: cellInSegment is `minX` (left cell).
          */
          // So for Vertical door between (x,y) and (x+1,y), the segment should contain (x,y).
          // Let's verify `fromAscii` logic.
          /*
            segment: [{x: x-1, y}, {x, y}] // For vertical door at x.
          */
          // It seems it stores BOTH cells adjacent?
          // GameGrid uses `some`. So if EITHER is in segment, it matches.
          // Wait, `cellInSegment` is calculated as `minX`.
          // So if moving (3,5)->(4,5), minX is 3. We check if door has (3,5).
          
          const cell1 = { x: Math.min(cx, cx+dir.dx), y: cy };
          segment = [cell1]; // Just need the left/top cell
      } else { // Vertical connection (North/South) -> Horizontal Door
          orientation = 'Horizontal';
          const cell1 = { x: cx, y: Math.min(cy, cy+dir.dy) };
          segment = [cell1];
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
      // Find floor cells
      const floors = this.cells.filter(c => c.type === CellType.Floor);
      if (floors.length === 0) return;

      // Spawn at far left
      const leftMost = floors.sort((a,b) => a.x - b.x)[0];
      this.spawnPoints.push({ id: 'spawn-1', pos: { x: leftMost.x, y: leftMost.y }, radius: 1 });

      // Extraction at far right
      const rightMost = floors.sort((a,b) => b.x - a.x)[0];
      this.extraction = { x: rightMost.x, y: rightMost.y };

      // Objective random, but not too close to spawn
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