import { MapDefinition, CellType, SpawnPoint, Objective, Cell } from '../shared/types';
import { PRNG } from '../shared/PRNG';

export class MapGenerator {
  private prng: PRNG;
  private maxTunnelWidth: number;
  private maxRoomSize: number;

  constructor(seed: number, maxTunnelWidth: number = 1, maxRoomSize: number = 2) {
    this.prng = new PRNG(seed);
    this.maxTunnelWidth = maxTunnelWidth;
    this.maxRoomSize = maxRoomSize;
  }

  public load(mapDefinition: MapDefinition): MapDefinition {
    // For predefined maps, we just return the map definition directly.
    // The generator's role here is to conform to the interface.
    return mapDefinition;
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
    

    // --- Procedural Layout Construction (Modified Prim's Algorithm) ---
    const frontier: { x: number, y: number, nx: number, ny: number, dir: 'n'|'e'|'s'|'w' }[] = [];
    const visited: boolean[][] = Array.from({ length: H }, () => Array(W).fill(false));

    const addFrontierWalls = (x: number, y: number) => {
        if (x > 0 && !visited[y][x-1]) frontier.push({ x, y, nx: x-1, ny: y, dir: 'w' });
        if (x < W-1 && !visited[y][x+1]) frontier.push({ x, y, nx: x+1, ny: y, dir: 'e' });
        if (y > 0 && !visited[y-1][x]) frontier.push({ x, y, nx: x, ny: y-1, dir: 'n' });
        if (y < H-1 && !visited[y+1][x]) frontier.push({ x, y, nx: x, ny: y+1, dir: 's' });
    };

    // Start from a random cell
    let startX = this.prng.nextInt(0, W - 1);
    let startY = this.prng.nextInt(0, H - 1);
    setFloor(startX, startY);
    visited[startY][startX] = true;
    addFrontierWalls(startX, startY);

    while (frontier.length > 0) {
        const wallIndex = this.prng.nextInt(0, frontier.length - 1);
        const [wall] = frontier.splice(wallIndex, 1); // Remove random wall

        const { x, y, nx, ny, dir } = wall;

        if (!visited[ny][nx]) {
            setFloor(nx, ny);
            openWall(x, y, dir);
            visited[ny][nx] = true;
            addFrontierWalls(nx, ny);
        }
    }

    // Add some 2x2 rooms randomly (post-processing)
    for (let i = 0; i < this.prng.nextInt(2, 5); i++) { // Add 2-4 rooms
        const rx = this.prng.nextInt(0, W - 2);
        const ry = this.prng.nextInt(0, H - 2);

        // Check if 2x2 area is mostly floor already, and has some walls to open
        let floorCount = 0;
        let wallCount = 0;
        for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
                const cell = getCell(rx + dx, ry + dy);
                if (cell?.type === CellType.Floor) floorCount++;
                else if (cell?.type === CellType.Wall) wallCount++;
            }
        }

        // If it's not already a 2x2 floor and has some walls to open
        if (floorCount < 4 && wallCount > 0) {
            for (let dy = 0; dy < 2; dy++) {
                for (let dx = 0; dx < 2; dx++) {
                    setFloor(rx + dx, ry + dy);
                }
            }
            // Open internal walls to create a cohesive room
            openWall(rx, ry, 'e'); // Cell (rx,ry) right
            openWall(rx + 1, ry, 'w'); // Cell (rx+1,ry) left

            openWall(rx, ry, 's'); // Cell (rx,ry) down
            openWall(rx, ry + 1, 'n'); // Cell (rx,ry+1) up

            openWall(rx + 1, ry, 's'); // Cell (rx+1,ry) down
            openWall(rx + 1, ry + 1, 'n'); // Cell (rx+1,ry+1) up
        }
    }

    // Ensure connectivity to a "start" and "end" area - for now, just place them in floor cells
    let startCell = getCell(startX, startY);
    while (startCell?.type !== CellType.Floor) {
        startX = this.prng.nextInt(0, W - 1);
        startY = this.prng.nextInt(0, H - 1);
        startCell = getCell(startX, startY);
    }

    let extractionX = this.prng.nextInt(0, W - 1);
    let extractionY = this.prng.nextInt(0, H - 1);
    let extractionCell = getCell(extractionX, extractionY);
    while (extractionCell?.type !== CellType.Floor || (extractionX === startX && extractionY === startY)) {
        extractionX = this.prng.nextInt(0, W - 1);
        extractionY = this.prng.nextInt(0, H - 1);
        extractionCell = getCell(extractionX, extractionY);
    }
    
    // Objective
    let objectiveX = this.prng.nextInt(0, W - 1);
    let objectiveY = this.prng.nextInt(0, H - 1);
    let objectiveCell = getCell(objectiveX, objectiveY);
    while (objectiveCell?.type !== CellType.Floor || (objectiveX === startX && objectiveY === startY) || (objectiveX === extractionX && objectiveY === extractionY)) {
        objectiveX = this.prng.nextInt(0, W - 1);
        objectiveY = this.prng.nextInt(0, H - 1);
        objectiveCell = getCell(objectiveX, objectiveY);
    }

    const extraction = { x: extractionX, y: extractionY }; 

    const objective: Objective = {
        id: 'obj1',
        kind: 'Recover',
        state: 'Pending',
        targetCell: { x: objectiveX, y: objectiveY } 
    };

    // Spawns
    const spawnPoints: SpawnPoint[] = [
        { id: 'sp1', pos: { x: startX, y: startY }, radius: 1 }, // Place a spawn near start
        { id: 'sp2', pos: { x: extractionX, y: extractionY }, radius: 1 }, // Place a spawn near extraction
        { id: 'sp3', pos: { x: objectiveX, y: objectiveY }, radius: 1 } // Place a spawn near objective
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
