import { MapDefinition, CellType, SpawnPoint, Objective, Cell } from '../shared/types';
import { PRNG } from '../shared/PRNG';

export class MapGenerator {
  private prng: PRNG;

  constructor(seed: number) {
    this.prng = new PRNG(seed);
  }

  public generate(width: number, height: number): MapDefinition {
    // Force 16x16 for this fixed layout, ignore args or center it
    const W = 16;
    const H = 16;
    const cells: Cell[] = [];

    // Initialize as Void
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        cells.push({
          x, y,
          type: CellType.Wall, // Void
          walls: { n: true, e: true, s: true, w: true }
        });
      }
    }

    const getCell = (x: number, y: number) => {
      if (x < 0 || x >= W || y < 0 || y >= H) return null;
      return cells[y * W + x];
    };

    const setFloor = (x: number, y: number) => {
      const c = getCell(x, y);
      if (c) c.type = CellType.Floor;
    };

    const openWall = (x: number, y: number, dir: 'n'|'e'|'s'|'w') => {
      const c = getCell(x, y);
      if (!c) return;
      c.walls[dir] = false;
      
      let nx = x, ny = y;
      let opp: 'n'|'e'|'s'|'w' = 's';
      if (dir === 'n') { ny--; opp = 's'; }
      if (dir === 'e') { nx++; opp = 'w'; }
      if (dir === 's') { ny++; opp = 'n'; }
      if (dir === 'w') { nx--; opp = 'e'; }
      
      const n = getCell(nx, ny);
      if (n) n.walls[opp] = false;
    };

    // --- Layout Construction ---
    // 1. Central Corridor (Vertical)
    for (let y = 2; y <= 13; y++) {
      setFloor(7, y);
      setFloor(8, y);
      // Connect horizontal pair
      openWall(7, y, 'e');
      // Connect vertical sequence
      if (y > 2) {
        openWall(7, y, 'n');
        openWall(8, y, 'n');
      }
    }

    // 2. Cross Corridor (Horizontal)
    for (let x = 2; x <= 13; x++) {
      setFloor(x, 7);
      setFloor(x, 8);
      // Connect vertical pair
      openWall(x, 7, 's');
      // Connect horizontal sequence
      if (x > 2) {
        openWall(x, 7, 'w');
        openWall(x, 8, 'w');
      }
    }

    // 3. Rooms
    // Top Left Room
    for (let y = 2; y <= 5; y++) {
        for (let x = 2; x <= 5; x++) {
            setFloor(x, y);
            if (x < 5) openWall(x, y, 'e');
            if (y < 5) openWall(x, y, 's');
        }
    }
    // Connect Room to Horizontal Corridor
    openWall(3, 5, 's'); // Path to (3, 6)? No, (3,6) is void.
    // Connect to (3,7) corridor?
    setFloor(3, 6); openWall(3, 6, 'n'); openWall(3, 6, 's');

    // Bottom Right Room
    for (let y = 10; y <= 13; y++) {
        for (let x = 10; x <= 13; x++) {
            setFloor(x, y);
            if (x < 13) openWall(x, y, 'e');
            if (y < 13) openWall(x, y, 's');
        }
    }
    // Connect
    setFloor(12, 9); openWall(12, 9, 'n'); openWall(12, 9, 's');

    // Start / Extraction
    const extraction = { x: 7, y: 13 }; // Bottom center

    // Objective
    const objective: Objective = {
        id: 'obj1',
        kind: 'Recover',
        state: 'Pending',
        targetCell: { x: 3, y: 3 } // Top Left Room
    };

    // Spawns
    const spawnPoints: SpawnPoint[] = [
        { id: 'sp1', pos: { x: 12, y: 12 }, radius: 1 }, // Bottom Right Room
        { id: 'sp2', pos: { x: 7, y: 2 }, radius: 1 },   // Top Center
        { id: 'sp3', pos: { x: 2, y: 7 }, radius: 1 }    // Left Center
    ];

    return {
        width: W,
        height: H,
        cells,
        extraction,
        objectives: [objective],
        spawnPoints
    };
  }
}
