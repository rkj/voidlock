import { MapDefinition, CellType, SpawnPoint, Objective, Cell, IMapValidationResult, Door, Vector2, TileAssembly, TileDefinition } from '../shared/types';
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


    const map = {
        width: W,
        height: H,
        cells,
        extraction,
        objectives: [objective],
        spawnPoints
    };

    MapGenerator.sanitize(map);
    return map;
  }

  public static sanitize(map: MapDefinition): void {
      const { width, height, cells, spawnPoints } = map;
      
      // 1. Identify all reachable Floor cells from SpawnPoints
      const reachable = new Set<string>();
      const queue: {x: number, y: number}[] = [];

      // Initialize from all spawn points
      if (spawnPoints) {
          for (const sp of spawnPoints) {
              queue.push(sp.pos);
              reachable.add(`${sp.pos.x},${sp.pos.y}`);
          }
      }

      const getCell = (x: number, y: number) => {
          if (x < 0 || x >= width || y < 0 || y >= height) return null;
          return cells[y * width + x];
      };

      // BFS Flood Fill
      let head = 0;
      while(head < queue.length) {
          const {x, y} = queue[head++];
          const cell = getCell(x, y);
          if (!cell || cell.type !== CellType.Floor) continue; // Should be Floor if in queue

          // Check neighbors through OPEN walls OR DOORS
          const dirs = [
              { dx: 0, dy: -1, wall: 'n' },
              { dx: 1, dy: 0, wall: 'e' },
              { dx: 0, dy: 1, wall: 's' },
              { dx: -1, dy: 0, wall: 'w' }
          ];

          for (const d of dirs) {
              let canTraverse = false;
              
              // 1. Check physical wall
              if (!(cell.walls as any)[d.wall]) {
                  canTraverse = true;
              } else {
                  // 2. Check for Door
                  // A door exists between (x,y) and neighbor?
                  // Door segment is [{x,y}, {nx,ny}] or vice versa.
                  const nx = x + d.dx;
                  const ny = y + d.dy;
                  
                  if (map.doors) {
                      for (const door of map.doors) {
                          if (door.segment.length === 2) {
                              const [s1, s2] = door.segment;
                              if ( (s1.x === x && s1.y === y && s2.x === nx && s2.y === ny) ||
                                   (s2.x === x && s2.y === y && s1.x === nx && s1.y === ny) ) {
                                  // Door exists. Even if closed, it implies connectivity for the sake of "not void".
                                  // The room behind a closed door is still part of the ship.
                                  canTraverse = true;
                                  break;
                              }
                          }
                      }
                  }
              }

              if (canTraverse) {
                  const nx = x + d.dx;
                  const ny = y + d.dy;
                  const nKey = `${nx},${ny}`;
                  
                  if (!reachable.has(nKey)) {
                      const neighbor = getCell(nx, ny);
                      if (neighbor) {
                          reachable.add(nKey);
                          queue.push({x: nx, y: ny});
                      }
                  }
              }
          }
      }

      // 2. Mark unreachable as Void and Reset Walls
      for (const cell of cells) {
          const key = `${cell.x},${cell.y}`;
          if (reachable.has(key)) {
              cell.type = CellType.Floor;
          } else {
              cell.type = CellType.Wall;
              cell.walls = { n: true, e: true, s: true, w: true };
          }
      }

      // 3. Close walls pointing to Void (fix "open wall to nowhere" for reachable cells)
      // This handles the case where a Reachable Floor connected to a Non-Existing (Out of bounds) or previously-Void-but-not-reachable?
      // Wait, if A is reachable and has open wall to B.
      // If B exists, we added B to queue. So B is reachable.
      // So B will be preserved as Floor.
      // The only case B is NOT reachable is if B does not exist (out of bounds).
      
      for (const cell of cells) {
          if (cell.type === CellType.Floor) {
              if (!cell.walls.n) {
                  const n = getCell(cell.x, cell.y - 1);
                  if (!n || n.type === CellType.Wall) cell.walls.n = true;
              }
              if (!cell.walls.e) {
                  const n = getCell(cell.x + 1, cell.y);
                  if (!n || n.type === CellType.Wall) cell.walls.e = true;
              }
              if (!cell.walls.s) {
                  const n = getCell(cell.x, cell.y + 1);
                  if (!n || n.type === CellType.Wall) cell.walls.s = true;
              }
              if (!cell.walls.w) {
                  const n = getCell(cell.x - 1, cell.y);
                  if (!n || n.type === CellType.Wall) cell.walls.w = true;
              }
          }
      }
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
                          if (isDoorHere && (door.state === 'Open' || door.state === 'Closed' || door.state === 'Destroyed')) {
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
    } else if (spawnPoints && spawnPoints.length === 0 && (cells.some(c => c.type === CellType.Floor) || extraction || (objectives?.length ?? 0) > 0)) {
        // If there are no spawn points, but there are floor cells or important points, it's an issue
        issues.push('Map has floor cells or important points but no spawn points to check reachability from.');
    }
    

    
    return { isValid: issues.length === 0, issues };
  }

  /**
   * Converts a MapDefinition to an ASCII string representation using an expanded grid format.
   * 
   * Grid Expansion:
   * The grid is expanded to (2*W + 1) x (2*H + 1) characters.
   * - Cells (x, y) map to ASCII coordinates (2*x + 1, 2*y + 1).
   * - Walls/Doors between cells are represented at the interstitial coordinates.
   * 
   * Character Legend:
   * - ' ': Floor cell or Open Passage
   * - '#': Wall/Void cell
   * - 'S', 'E', 'O': Spawn, Extraction, Objective (on Floor)
   * 
   * Boundaries (Walls):
   * - '-': Horizontal Wall segment
   * - '|': Vertical Wall segment
   * - '+': Corner (intersection of walls)
   * 
   * Doors (Replacing Walls):
   * - '=': Horizontal Door (replaces a '-' segment between vertical neighbors)
   * - 'I': Vertical Door (replaces a '|' segment between horizontal neighbors)
   */
  public static toAscii(map: MapDefinition): string {
    const { width, height, cells, doors, spawnPoints, extraction, objectives } = map;
    const expandedWidth = width * 2 + 1;
    const expandedHeight = height * 2 + 1;

    // Initialize asciiGrid with spaces for content and empty strings for walls/corners initially
    const asciiGrid: string[][] = Array.from({ length: expandedHeight }, () => Array(expandedWidth).fill(' '));

    // Create lookup for cells for efficient access
    const cellLookup = new Map<string, Cell>();
    cells.forEach(cell => cellLookup.set(`${cell.x},${cell.y}`, cell));

    // Helper to get expanded grid coordinates
    const getExEy = (x: number, y: number) => ({ ex: x * 2 + 1, ey: y * 2 + 1 });

    // --- Populate the grid based on MapDefinition ---
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = cellLookup.get(`${x},${y}`);
        const { ex, ey } = getExEy(x, y);

        // --- Cell Content ---
        if (cell?.type === CellType.Wall) {
          asciiGrid[ey][ex] = '#'; // Wall cell (impassable, "void" or "outside" the ship)
        } else if (cell?.type === CellType.Floor) {
          // Floor Cell Content - prioritize S > E > O
          let cellChar = ' ';
          const isSpawnPoint = spawnPoints?.some(sp => sp.pos.x === x && sp.pos.y === y);
          const isExtraction = extraction && extraction.x === x && extraction.y === y;
          const isObjective = objectives?.some(obj => obj.targetCell?.x === x && obj.targetCell?.y === y);

          if (isSpawnPoint) cellChar = 'S';
          else if (isExtraction) cellChar = 'E';
          else if (isObjective) cellChar = 'O';
          
          asciiGrid[ey][ex] = cellChar;
        }

        // --- Walls and Passages ---
        // Determine wall characters based on cell.walls property
        // North wall
        if (cell?.walls.n) asciiGrid[ey - 1][ex] = '-';
        // East wall
        if (cell?.walls.e) asciiGrid[ey][ex + 1] = '|';
        // South wall
        if (cell?.walls.s) asciiGrid[ey + 1][ex] = '-';
        // West wall
        if (cell?.walls.w) asciiGrid[ey][ex - 1] = '|';

        // Also check neighbors to ensure shared walls are rendered
        const southCell = cellLookup.get(`${x},${y+1}`);
        if (southCell?.walls.n) asciiGrid[ey + 1][ex] = '-';
        const eastCell = cellLookup.get(`${x+1},${y}`);
        if (eastCell?.walls.w) asciiGrid[ey][ex + 1] = '|';
      }
    }

    // --- Overlay Doors ---
    doors?.forEach(door => {
      if (door.segment.length === 2) {
        const [p1, p2] = door.segment;
        let ex_door, ey_door;

        // Determine the expanded grid position for the door based on segment
        if (p1.x === p2.x && Math.abs(p1.y - p2.y) === 1) { // Horizontal wall segment (vertical door)
          ex_door = p1.x * 2 + 1;
          ey_door = Math.min(p1.y, p2.y) * 2 + 2; 
          asciiGrid[ey_door][ex_door] = '=';
        } else if (p1.y === p2.y && Math.abs(p1.x - p2.x) === 1) { // Vertical wall segment (horizontal door)
          ex_door = Math.min(p1.x, p2.x) * 2 + 2;
          ey_door = p1.y * 2 + 1;
          asciiGrid[ey_door][ex_door] = 'I';
        }
      }
    });

    // --- Overlay outer borders (always walls) ---
    for (let x = 0; x < expandedWidth; x++) {
      if (x % 2 === 1) { // Horizontal segments
        if (asciiGrid[0][x] === ' ') asciiGrid[0][x] = '-';
        if (asciiGrid[expandedHeight - 1][x] === ' ') asciiGrid[expandedHeight - 1][x] = '-';
      }
    }
    for (let y = 0; y < expandedHeight; y++) {
      if (y % 2 === 1) { // Vertical segments
        if (asciiGrid[y][0] === ' ') asciiGrid[y][0] = '|';
        if (asciiGrid[y][expandedWidth - 1] === ' ') asciiGrid[y][expandedWidth - 1] = '|';
      }
    }

    // --- Final Pass: Corners ---
    for (let y = 0; y < expandedHeight; y += 2) {
      for (let x = 0; x < expandedWidth; x += 2) {
        // If it's a corner that is not already marked as a wall part ('#')
        if (asciiGrid[y][x] === ' ') { // Only consider spaces to become '+'
          let wallCount = 0;
          // Check adjacent segments for wall characters
          // North/South are Vertical segments
          if (y > 0 && ['|', 'I', '#'].includes(asciiGrid[y - 1][x])) wallCount++; // North
          if (y < expandedHeight - 1 && ['|', 'I', '#'].includes(asciiGrid[y + 1][x])) wallCount++; // South
          // East/West are Horizontal segments
          if (x > 0 && ['-', '=', '#'].includes(asciiGrid[y][x - 1])) wallCount++; // West
          if (x < expandedWidth - 1 && ['-', '=', '#'].includes(asciiGrid[y][x + 1])) wallCount++; // East
          
          if (wallCount >= 2) { // Only draw '+' if it connects at least two walls/doors/voids
            asciiGrid[y][x] = '+';
          }
        }
      }
    }
    
    return asciiGrid.map(row => row.join('')).join('\n');
  }


  public static assemble(assembly: TileAssembly, library: Record<string, TileDefinition>): MapDefinition {
    // 1. Calculate Bounds
    // This is a bit tricky as the map size depends on tile placement.
    // We can either require width/height in assembly, or compute bounding box.
    // For now, let's assume a fixed max size or compute it.
    // Actually, MapDefinition requires fixed width/height.
    // Let's compute min/max x/y.
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // Helper to rotate a point (px, py) within a rect (w, h)
    // Rotation is clockwise: 0, 90, 180, 270.
    // 0: (x, y)
    // 90: (h - 1 - y, x) -> New width is h, new height is w.
    // 180: (w - 1 - x, h - 1 - y)
    // 270: (y, w - 1 - x) -> New width is h, new height is w.
    const rotatePoint = (px: number, py: number, w: number, h: number, rot: 0|90|180|270): { x: number, y: number } => {
        switch (rot) {
            case 0: return { x: px, y: py };
            case 90: return { x: h - 1 - py, y: px };
            case 180: return { x: w - 1 - px, y: h - 1 - py };
            case 270: return { x: py, y: w - 1 - px };
        }
    };

    const getRotatedDimensions = (w: number, h: number, rot: 0|90|180|270): { w: number, h: number } => {
        if (rot === 90 || rot === 270) return { w: h, h: w };
        return { w, h };
    };

    // First pass: Compute Map Bounds
    assembly.tiles.forEach(tileRef => {
        const def = library[tileRef.tileId];
        if (!def) throw new Error(`Tile definition not found: ${tileRef.tileId}`);
        
        const { w, h } = getRotatedDimensions(def.width, def.height, tileRef.rotation);
        
        minX = Math.min(minX, tileRef.x);
        minY = Math.min(minY, tileRef.y);
        maxX = Math.max(maxX, tileRef.x + w - 1);
        maxY = Math.max(maxY, tileRef.y + h - 1);
    });

    // If no tiles, return empty small map
    if (minX === Infinity) return { width: 1, height: 1, cells: [] };

    // We normalize to (0,0).
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    // Initialize Grid with Walls/Void
    const cells: Cell[] = Array(width * height).fill(null).map((_, i) => {
        const x = i % width;
        const y = Math.floor(i / width);
        return {
            x, y,
            type: CellType.Wall,
            walls: { n: true, e: true, s: true, w: true }
        };
    });

    const getCellIndex = (x: number, y: number) => y * width + x;

    // Second pass: Place Tiles
    assembly.tiles.forEach(tileRef => {
        const def = library[tileRef.tileId];
        const { w: tileW, h: tileH } = getRotatedDimensions(def.width, def.height, tileRef.rotation);

        def.cells.forEach(cellDef => {
            // Rotate local cell position
            const localPos = rotatePoint(cellDef.x, cellDef.y, def.width, def.height, tileRef.rotation);
            
            // Global position (normalized by minX/minY)
            const globalX = tileRef.x + localPos.x - minX;
            const globalY = tileRef.y + localPos.y - minY;

            if (globalX < 0 || globalX >= width || globalY < 0 || globalY >= height) {
                // Should not happen if bounds are correct
                return;
            }

            const cellIndex = getCellIndex(globalX, globalY);
            const cell = cells[cellIndex];
            cell.type = CellType.Floor;

            // Handle Open Edges
            // Rotate edges: n -> e -> s -> w -> n
            const rotateEdge = (edge: 'n'|'e'|'s'|'w', rot: 0|90|180|270): 'n'|'e'|'s'|'w' => {
                const edges: ('n'|'e'|'s'|'w')[] = ['n', 'e', 's', 'w'];
                const idx = edges.indexOf(edge);
                const shift = rot / 90;
                return edges[(idx + shift) % 4];
            };

            const rotatedOpenEdges = cellDef.openEdges.map(e => rotateEdge(e, tileRef.rotation));

            // Set walls to false if edge is open
            if (rotatedOpenEdges.includes('n')) cell.walls.n = false;
            if (rotatedOpenEdges.includes('e')) cell.walls.e = false;
            if (rotatedOpenEdges.includes('s')) cell.walls.s = false;
            if (rotatedOpenEdges.includes('w')) cell.walls.w = false;
        });
    });

    // Extract global entities
    const doors: Door[] = assembly.globalDoors?.map((d, i) => ({
        id: d.id,
        // Adjust coordinates relative to minX/minY
        // Note: Door 'cell' is usually the primary cell of the pair.
        // Wait, 'segment' in our engine is Vector2[].
        // assembly.globalDoors uses 'cell' and 'orientation'.
        // We need to convert to 'segment'.
        orientation: d.orientation,
        state: 'Closed',
        hp: 50, maxHp: 50, openDuration: 1,
        segment: d.orientation === 'Vertical' 
            ? [{ x: d.cell.x - minX - 1, y: d.cell.y - minY }, { x: d.cell.x - minX, y: d.cell.y - minY }] // West of cell? Or East?
            // If assembly says "Door at (5,5) Vertical", does it mean West edge or East edge?
            // Convention: usually specific. Let's assume 'Vertical' at (x,y) means the edge between (x-1,y) and (x,y) -> West Edge.
            // Or typically coordinates in tile maps refer to the tile ITSELF.
            // Let's assume the input `globalDoors` defines the cell coordinate and the edge ON that cell.
            // Actually, `globalDoors` has `cell: Vector2`.
            // Let's assume Vertical door at (x,y) is on the WEST edge of (x,y).
            : [{ x: d.cell.x - minX, y: d.cell.y - minY - 1 }, { x: d.cell.x - minX, y: d.cell.y - minY }] // Horizontal: North edge
    })) || [];

    const spawnPoints = assembly.globalSpawnPoints?.map(sp => ({
        id: sp.id,
        pos: { x: sp.cell.x - minX, y: sp.cell.y - minY },
        radius: 1
    })) || [];

    const extraction = assembly.globalExtraction ? { x: assembly.globalExtraction.cell.x - minX, y: assembly.globalExtraction.cell.y - minY } : undefined;

    const objectives = assembly.globalObjectives?.map(obj => ({
        id: obj.id,
        kind: obj.kind,
        state: 'Pending' as const,
        targetCell: { x: obj.cell.x - minX, y: obj.cell.y - minY }
    })) || [];

    return {
        width,
        height,
        cells,
        doors,
        spawnPoints,
        extraction,
        objectives
    };
  }

  // Placeholder for fromAscii method
  public static fromAscii(asciiMap: string): MapDefinition {
    const lines = asciiMap.split('\n').filter(line => line.length > 0);
    if (lines.length === 0) throw new Error("Empty ASCII map");

    const expandedHeight = lines.length;
    const expandedWidth = lines[0].length;
    const height = Math.floor((expandedHeight - 1) / 2);
    const width = Math.floor((expandedWidth - 1) / 2);

    const cells: Cell[] = [];
    const doors: Door[] = [];
    const spawnPoints: SpawnPoint[] = [];
    const objectives: Objective[] = [];
    let extraction: Vector2 | undefined = undefined;

    // First pass: Create cells and set types
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ex = x * 2 + 1;
        const ey = y * 2 + 1;
        
        // Safety check for line length
        if (ex >= lines[ey].length) {
             cells.push({ x, y, type: CellType.Wall, walls: { n: true, e: true, s: true, w: true } });
             continue;
        }

        const char = lines[ey][ex];
        const type = char === '#' ? CellType.Wall : CellType.Floor;
        
        cells.push({
            x, y, type,
            walls: { n: false, e: false, s: false, w: false } 
        });

        if (type === CellType.Floor) {
            if (char === 'S') spawnPoints.push({ id: `sp-${spawnPoints.length}`, pos: { x, y }, radius: 1 });
            if (char === 'E') extraction = { x, y };
            if (char === 'O') objectives.push({ id: `obj-${objectives.length}`, kind: 'Recover', state: 'Pending', targetCell: { x, y } });
        }
      }
    }

    const getCell = (x: number, y: number) => cells.find(c => c.x === x && c.y === y);

    // Second pass: Walls
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const cell = getCell(x, y);
            if (!cell) continue;
            
            const ex = x * 2 + 1;
            const ey = y * 2 + 1;
            
            // Helper to check if char represents a wall
            const isHWall = (c: string) => ['-', '=', '#'].includes(c);
            const isVWall = (c: string) => ['|', 'I', '#'].includes(c);

            // North
            if (ey - 1 >= 0) cell.walls.n = isHWall(lines[ey - 1][ex]);
            // South
            if (ey + 1 < expandedHeight) cell.walls.s = isHWall(lines[ey + 1][ex]);
            // East
            if (ex + 1 < lines[ey].length) cell.walls.e = isVWall(lines[ey][ex + 1]);
            // West
            if (ex - 1 >= 0) cell.walls.w = isVWall(lines[ey][ex - 1]);
        }
    }

    // Third pass: Doors
    let doorIdCounter = 0;
    // Horizontal segments (checking for Vertical Doors 'I')
    for (let y = 0; y < height; y++) {
        for (let x = 1; x < width; x++) { // Edges between columns
            const ex = x * 2;
            const ey = y * 2 + 1;
            if (ey < expandedHeight && ex < lines[ey].length && lines[ey][ex] === 'I') {
                doors.push({
                    id: `d-${doorIdCounter++}`,
                    orientation: 'Vertical',
                    state: 'Closed',
                    hp: 50, maxHp: 50, openDuration: 1,
                    segment: [{x: x-1, y}, {x, y}]
                });
            }
        }
    }
    // Vertical segments (checking for Horizontal Doors '=')
    for (let y = 1; y < height; y++) { // Edges between rows
        for (let x = 0; x < width; x++) {
             const ex = x * 2 + 1;
             const ey = y * 2;
             if (ey < expandedHeight && ex < lines[ey].length && lines[ey][ex] === '=') {
                doors.push({
                    id: `d-${doorIdCounter++}`,
                    orientation: 'Horizontal',
                    state: 'Closed',
                    hp: 50, maxHp: 50, openDuration: 1,
                    segment: [{x, y: y-1}, {x, y}]
                });
            }
        }
    }

    return {
      width,
      height,
      cells,
      doors,
      spawnPoints,
      extraction,
      objectives
    };
  }
}

