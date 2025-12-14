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

  public validate(map: MapDefinition): IMapValidationResult {
    const issues: string[] = [];

    const { width, height, cells, doors, spawnPoints, extraction, objectives } = map;

    // 1. Map dimensions: width and height should be positive.
    if (width <= 0 || height <= 0) {
      issues.push('Map dimensions (width and height) must be positive.');
    }

    // Helper to check if a coordinate is within map bounds
    const isWithinBounds = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height;

    // Build a quick lookup map for cells and check for duplicates/bounds
    const cellLookup = new Map<string, Cell>();
    for (const cell of cells) {
      const key = `${cell.x},${cell.y}`;
      if (cellLookup.has(key)) {
        issues.push(`Duplicate cell definition at (${cell.x}, ${cell.y}).`);
      }
      cellLookup.set(key, cell);

      if (!isWithinBounds(cell.x, cell.y)) {
        issues.push(`Cell at (${cell.x}, ${cell.y}) is out of map bounds.`);
      }
    }
    if (cells.length !== width * height) {
      issues.push(`Number of cells (${cells.length}) does not match map dimensions (${width}x${height} = ${width * height}).`);
    }

    // Helper to get a cell safely using the lookup map
    const getCell = (x: number, y: number): Cell | undefined => {
      if (!isWithinBounds(x, y)) return undefined;
      return cellLookup.get(`${x},${y}`);
    };




    // 3. Doors:
    if (doors) {
      for (const door of doors) {
        if (!door.id) {
          issues.push('Door found with no ID.');
        }
        if (!door.segment || door.segment.length === 0) {
          issues.push(`Door ${door.id} has no segments defined.`);
          continue;
        }
        if (door.segment.length > 2) { // Doors are expected to be between 2 cells
          issues.push(`Door ${door.id} has more than 2 segments, which is not supported.`);
        }

        // Validate segment coordinates and ensure they are Floor cells
        const connectedFloorCells: Vector2[] = [];
        for (const segmentPart of door.segment) {
          if (!isWithinBounds(segmentPart.x, segmentPart.y)) {
            issues.push(`Door ${door.id} segment at (${segmentPart.x}, ${segmentPart.y}) is out of map bounds.`);
          } else {
            const cell = getCell(segmentPart.x, segmentPart.y);
            if (!cell || cell.type !== CellType.Floor) {
              issues.push(`Door ${door.id} segment at (${segmentPart.x}, ${segmentPart.y}) is not adjacent to a Floor cell.`);
            } else {
              connectedFloorCells.push(segmentPart);
            }
          }
        }
        // Further check: ensure segments are adjacent and form a valid door (e.g., horizontal or vertical)
        if (connectedFloorCells.length === 2) {
          const [p1, p2] = connectedFloorCells;
          const dx = Math.abs(p1.x - p2.x);
          const dy = Math.abs(p1.y - p2.y);
          if (!((dx === 1 && dy === 0) || (dx === 0 && dy === 1))) {
            issues.push(`Door ${door.id} segments at (${p1.x},${p1.y}) and (${p2.x},${p2.y}) are not adjacent.`);
          }
        } else if (connectedFloorCells.length === 1) {
          // A single segment, maybe a door at the map edge or connecting only one floor cell.
          // This might be valid depending on more specific door rules, but for now, flag it if it's not a border door.
          // For simplicity, let's assume doors always connect two adjacent floor cells.
          issues.push(`Door ${door.id} segment defines only one connected floor cell. Doors should span between two adjacent floor cells.`);
        }
      }
    }

    // 4. Spawn Points:
    if (!spawnPoints || spawnPoints.length === 0) {
      issues.push('No spawn points defined.');
    } else {
      const spawnPointIds = new Set<string>();
      for (const sp of spawnPoints) {
        if (!sp.id) {
          issues.push('Spawn point found with no ID.');
        } else if (spawnPointIds.has(sp.id)) {
          issues.push(`Duplicate spawn point ID: ${sp.id}.`);
        }
        spawnPointIds.add(sp.id);

        if (!isWithinBounds(sp.pos.x, sp.pos.y)) {
          issues.push(`Spawn point ${sp.id} at (${sp.pos.x}, ${sp.pos.y}) is out of map bounds.`);
        } else {
          const cell = getCell(sp.pos.x, sp.pos.y);
          if (!cell || cell.type !== CellType.Floor) {
            issues.push(`Spawn point ${sp.id} at (${sp.pos.x}, ${sp.pos.y}) is not on a Floor cell.`);
          }
        }
      }
    }

    // 5. Extraction Point:
    if (!extraction) {
      issues.push('No extraction point defined.');
    } else {
      if (!isWithinBounds(extraction.x, extraction.y)) {
        issues.push(`Extraction point at (${extraction.x}, ${extraction.y}) is out of map bounds.`);
      } else {
        const cell = getCell(extraction.x, extraction.y);
        if (!cell || cell.type !== CellType.Floor) {
          issues.push(`Extraction point at (${extraction.x}, ${extraction.y}) is not on a Floor cell.`);
        }
      }
    }

    // 6. Objectives:
    if (!objectives || objectives.length === 0) {
      issues.push('No objectives defined.');
    } else {
      const objectiveIds = new Set<string>();
      for (const obj of objectives) {
        if (!obj.id) {
          issues.push('Objective found with no ID.');
        } else if (objectiveIds.has(obj.id)) {
          issues.push(`Duplicate objective ID: ${obj.id}.`);
        }
        objectiveIds.add(obj.id);

        if (obj.targetCell) {
          if (!isWithinBounds(obj.targetCell.x, obj.targetCell.y)) {
            issues.push(`Objective ${obj.id} target cell at (${obj.targetCell.x}, ${obj.targetCell.y}) is out of map bounds.`);
          } else {
            const cell = getCell(obj.targetCell.x, obj.targetCell.y);
            if (!cell || cell.type !== CellType.Floor) {
                          issues.push(`Objective ${obj.id} target cell at (${obj.targetCell.x}, ${obj.targetCell.y}) is not on a Floor cell.`);            }
          }
        } else if (obj.kind === 'Kill' && !obj.targetEnemyId) {
          issues.push(`Objective ${obj.id} of kind 'Kill' must specify a targetEnemyId.`);
        } else if (obj.kind !== 'Kill' && !obj.targetCell) {
           issues.push(`Objective ${obj.id} of kind '${obj.kind}' must specify a targetCell.`);
        }
      }
    }

    // 7. Connectivity Check (Flood-fill/BFS from all spawn points)
    // For now, we proceed with structural validation.
    if (spawnPoints && spawnPoints.length > 0) {
      const visitedCells = new Set<string>();
      const queue: Vector2[] = [];

      // Start BFS from all spawn points
      for (const sp of spawnPoints) {
        const startPos = sp.pos;
        const cell = getCell(startPos.x, startPos.y);
        if (cell && cell.type === CellType.Floor) {
          queue.push(startPos);
          visitedCells.add(`${startPos.x},${startPos.y}`);
        }
      }

      let head = 0;
      while(head < queue.length) {
        const current = queue[head++];
        const currentCell = getCell(current.x, current.y);
        if (!currentCell) continue;

        const neighbors = [
          { x: current.x, y: current.y - 1, wall: 'n' as 'n'|'e'|'s'|'w', oppWall: 's' as 'n'|'e'|'s'|'w' }, // North
          { x: current.x + 1, y: current.y, wall: 'e' as 'n'|'e'|'s'|'w', oppWall: 'w' as 'n'|'e'|'s'|'w' }, // East
          { x: current.x, y: current.y + 1, wall: 's' as 'n'|'e'|'s'|'w', oppWall: 'n' as 'n'|'e'|'s'|'w' }, // South
          { x: current.x - 1, y: current.y, wall: 'w' as 'n'|'e'|'s'|'w', oppWall: 'e' as 'n'|'e'|'s'|'w' }  // West
        ];

        for (const neighbor of neighbors) {
          const neighborCell = getCell(neighbor.x, neighbor.y);
          if (neighborCell && neighborCell.type === CellType.Floor && !visitedCells.has(`${neighbor.x},${neighbor.y}`)) {
            // Check wall blocking
            const hasWallBetween = currentCell.walls[neighbor.wall] || neighborCell.walls[neighbor.oppWall];

            let canTraverse = false;
            if (!hasWallBetween) { // No wall, so definitely can traverse
              canTraverse = true;
            } else { // There is a wall, check if it's a non-blocking door
              let foundNonBlockingDoor = false;
              if (doors && doors.length > 0) {
                  for (const door of doors) {
                      if (door.segment.length === 2) {
                          const [s1, s2] = door.segment;
                          // Check if this door is between current and neighbor
                          const isDoorHere = 
                              ( (s1.x === current.x && s1.y === current.y && s2.x === neighbor.x && s2.y === neighbor.y) ||
                                (s2.x === current.x && s2.y === current.y && s1.x === neighbor.x && s1.y === neighbor.y) );
                          if (isDoorHere && (door.state === 'Open' || door.state === 'Destroyed')) {
                              foundNonBlockingDoor = true;
                              break;
                          }
                      }
                  }
              }
              if (foundNonBlockingDoor) {
                canTraverse = true;
              }
            }
            
            if (canTraverse) {
                visitedCells.add(`${neighbor.x},${neighbor.y}`);
                queue.push({ x: neighbor.x, y: neighbor.y });
            }
          }
        }
      }

      // Check reachability of all Floor cells
      for (const cell of cells) {
        if (cell.type === CellType.Floor && !visitedCells.has(`${cell.x},${cell.y}`)) {
          issues.push(`Floor cell at (${cell.x}, ${cell.y}) is not reachable from any spawn point.`);
        }
      }

      // Check reachability of Extraction Point
      if (extraction && !visitedCells.has(`${extraction.x},${extraction.y}`)) {
        issues.push(`Extraction point at (${extraction.x}, ${extraction.y}) is not reachable from any spawn point.`);
      }

      // Check reachability of Objective Target Cells
      if (objectives) {
        for (const obj of objectives) {
          if (obj.targetCell && !visitedCells.has(`${obj.targetCell.x},${obj.targetCell.y}`)) {
            issues.push(`Objective ${obj.id} target cell at (${obj.targetCell.x}, ${obj.targetCell.y}) is not reachable from any spawn point.`);
          }
        }
      }
    } else if (spawnPoints && spawnPoints.length === 0 && (cells.some(c => c.type === CellType.Floor) || extraction || objectives?.length > 0)) {
        // If there are no spawn points, but there are floor cells or important points, it's an issue
        issues.push('Map has floor cells or important points but no spawn points to check reachability from.');
    }
    

    
    return { isValid: issues.length === 0, issues };
  }

  // Placeholder for toAscii method
  public static toAscii(map: MapDefinition): string {
    console.warn("MapGenerator.toAscii is a placeholder and not yet implemented.");
    return ''; // Placeholder
  }

  // Placeholder for fromAscii method
  public static fromAscii(asciiMap: string): MapDefinition {
    console.warn("MapGenerator.fromAscii is a placeholder and not yet implemented.");
    // Return a minimal valid map definition for now
    return {
      width: 1,
      height: 1,
      cells: [{ x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } }],
      spawnPoints: [{ id: 'sp1', pos: { x: 0, y: 0 }, radius: 1 }],
      extraction: { x: 0, y: 0 },
      objectives: [{ id: 'obj1', kind: 'Recover', targetCell: { x: 0, y: 0 } }],
    };
  }
}

