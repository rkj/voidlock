import { MapDefinition, CellType, SpawnPoint, Objective, Cell } from '../shared/types';
import { PRNG } from '../shared/PRNG';

export class MapGenerator {
  private prng: PRNG;

  constructor(seed: number) {
    this.prng = new PRNG(seed);
  }

  public generate(width: number, height: number): MapDefinition {
    // 1. Initialize grid with all walls closed
    const cells: Cell[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        cells.push({
          x, y,
          type: CellType.Floor, // Everything is floor inside ship
          walls: { n: true, e: true, s: true, w: true }
        });
      }
    }

    const getCell = (x: number, y: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return null;
      return cells[y * width + x];
    };

    // 2. Recursive Backtracker Maze
    const startX = Math.floor(width / 2);
    const startY = Math.floor(height / 2);
    const stack: Cell[] = [];
    const visited = new Set<string>();

    const startCell = getCell(startX, startY)!;
    stack.push(startCell);
    visited.add(`${startX},${startY}`);

    while (stack.length > 0) {
      const current = stack[stack.length - 1]; // Peek
      const neighbors = [];

      const dirs = [
        { dx: 0, dy: -1, wall: 'n', opp: 's' },
        { dx: 1, dy: 0, wall: 'e', opp: 'w' },
        { dx: 0, dy: 1, wall: 's', opp: 'n' },
        { dx: -1, dy: 0, wall: 'w', opp: 'e' }
      ];

      for (const dir of dirs) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;
        const neighbor = getCell(nx, ny);
        if (neighbor && !visited.has(`${nx},${ny}`)) {
          neighbors.push({ neighbor, dir });
        }
      }

      if (neighbors.length > 0) {
        const chosen = neighbors[this.prng.nextInt(0, neighbors.length - 1)];
        const { neighbor, dir } = chosen;

        // Remove walls
        (current.walls as any)[dir.wall] = false;
        (neighbor.walls as any)[dir.opp] = false;

        visited.add(`${neighbor.x},${neighbor.y}`);
        stack.push(neighbor);
      } else {
        stack.pop();
      }
    }

    // 3. Braiding (remove dead ends)
    // Dead end = cell with 3 walls
    for (const cell of cells) {
      const wallCount = (cell.walls.n ? 1 : 0) + (cell.walls.e ? 1 : 0) + (cell.walls.s ? 1 : 0) + (cell.walls.w ? 1 : 0);
      if (wallCount >= 3) {
        // Remove a random wall to a valid neighbor (even if visited)
        // Check bounds
        const dirs = [
            { dx: 0, dy: -1, wall: 'n', opp: 's' },
            { dx: 1, dy: 0, wall: 'e', opp: 'w' },
            { dx: 0, dy: 1, wall: 's', opp: 'n' },
            { dx: -1, dy: 0, wall: 'w', opp: 'e' }
        ];
        // Filter valid neighbors
        const validDirs = dirs.filter(d => {
            const n = getCell(cell.x + d.dx, cell.y + d.dy);
            return n !== null;
        });
        
        if (validDirs.length > 0) {
             // Maybe probability check? 50%?
             if (this.prng.next() > 0.5) {
                 const d = validDirs[this.prng.nextInt(0, validDirs.length - 1)];
                 const n = getCell(cell.x + d.dx, cell.y + d.dy)!;
                 (cell.walls as any)[d.wall] = false;
                 (n.walls as any)[d.opp] = false;
             }
        }
      }
    }

    // 4. Placements
    // Extraction at center (start)
    const extraction = { x: startX, y: startY };

    // Objective: Furthest point? Or random.
    // Random for prototype.
    let objectiveCell = cells[this.prng.nextInt(0, cells.length - 1)];
    while(objectiveCell.x === startX && objectiveCell.y === startY) {
        objectiveCell = cells[this.prng.nextInt(0, cells.length - 1)];
    }
    const objective: Objective = {
        id: 'obj1',
        kind: 'Recover',
        state: 'Pending',
        targetCell: { x: objectiveCell.x, y: objectiveCell.y }
    };

    // Spawn Points (corners)
    const spawnPoints: SpawnPoint[] = [];
    spawnPoints.push({ id: 'sp1', pos: { x: 0, y: 0 }, radius: 1 });
    spawnPoints.push({ id: 'sp2', pos: { x: width - 1, y: 0 }, radius: 1 });
    spawnPoints.push({ id: 'sp3', pos: { x: 0, y: height - 1 }, radius: 1 });
    spawnPoints.push({ id: 'sp4', pos: { x: width - 1, y: height - 1 }, radius: 1 });

    return {
        width,
        height,
        cells,
        extraction,
        objectives: [objective],
        spawnPoints
    };
  }
}