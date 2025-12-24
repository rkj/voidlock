import { MapDefinition, CellType, SpawnPoint, Objective, Cell, IMapValidationResult, Door, Vector2, TileAssembly, TileDefinition, MapGeneratorType, ObjectiveDefinition } from '../shared/types';
import { PRNG } from '../shared/PRNG';
import { TreeShipGenerator } from './generators/TreeShipGenerator';
import { SpaceshipGenerator } from './generators/SpaceshipGenerator';
import { DenseShipGenerator } from './generators/DenseShipGenerator';

export class MapGenerator {
  private prng: PRNG;
  private seed: number;

  constructor(seed: number) {
    this.prng = new PRNG(seed);
    this.seed = seed;
  }

  public generate(width: number, height: number, type: MapGeneratorType = MapGeneratorType.Procedural, spawnPointCount?: number): MapDefinition {
    const spCount = spawnPointCount ?? 1;
    switch (type) {
        case MapGeneratorType.TreeShip:
            return new TreeShipGenerator(this.seed, width, height).generate(spCount);
        case MapGeneratorType.Procedural:
            return new SpaceshipGenerator(this.seed, width, height).generate(spCount);
        case MapGeneratorType.DenseShip:
            return new DenseShipGenerator(this.seed, width, height).generate(spCount);
        default:
            return new SpaceshipGenerator(this.seed, width, height).generate(spCount);
    }
  }

  public load(mapDefinition: MapDefinition): MapDefinition {
    return mapDefinition;
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
          if (!cell || cell.type !== CellType.Floor) continue; 

          // Check neighbors through OPEN walls OR DOORS
          const dirs = [
              { dx: 0, dy: -1, wall: 'n' },
              { dx: 1, dy: 0, wall: 'e' },
              { dx: 0, dy: 1, wall: 's' },
              { dx: -1, dy: 0, wall: 'w' }
          ];

          for (const d of dirs) {
              let canTraverse = false;
              
              if (!(cell.walls as any)[d.wall]) {
                  canTraverse = true;
              } else {
                  const nx = x + d.dx;
                  const ny = y + d.dy;
                  
                  if (map.doors) {
                      for (const door of map.doors) {
                          if (door.segment.length === 2) {
                              const [s1, s2] = door.segment;
                              if ( (s1.x === x && s1.y === y && s2.x === nx && s2.y === ny) ||
                                   (s2.x === x && s2.y === y && s1.x === nx && s1.y === ny) ) {
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
                      if (neighbor && neighbor.type === CellType.Floor) {
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

      // 3. Reset Walls for Floor cells (and enforce consistency)
      for (const cell of cells) {
          if (cell.type === CellType.Floor) {
              const checkAndFix = (dir: 'n'|'e'|'s'|'w', nx: number, ny: number, opp: 'n'|'e'|'s'|'w') => {
                  const n = getCell(nx, ny);
                  // 1. If neighbor is Wall/Void, this wall MUST be closed.
                  if (!n || n.type === CellType.Wall) {
                      cell.walls[dir] = true;
                  } else {
                      // 2. If neighbor is Floor, ensure consistency.
                      // If 'cell' says Open, 'n' must say Open.
                      // If 'cell' says Closed, 'n' must say Closed? 
                      // actually, if we want to fix "One-Way", we should OR them? 
                      // If EITHER is Open, make BOTH Open?
                      // Or if EITHER is Closed, make BOTH Closed?
                      
                      // Given the bug (Invisible Wall), we have Open->Closed.
                      // We want Open->Open.
                      if (!cell.walls[dir]) {
                          n.walls[opp] = false;
                      } else if (!n.walls[opp]) {
                          cell.walls[dir] = false;
                      }
                  }
              };
              
              checkAndFix('n', cell.x, cell.y - 1, 's');
              checkAndFix('e', cell.x + 1, cell.y, 'w');
              checkAndFix('s', cell.x, cell.y + 1, 'n');
              checkAndFix('w', cell.x - 1, cell.y, 'e');
          }
      }

      // 4. Remove Doors connected to Void
      if (map.doors) {
          map.doors = map.doors.filter(door => {
              if (door.segment.length !== 2) return false;
              const [s1, s2] = door.segment;
              const c1 = getCell(s1.x, s1.y);
              const c2 = getCell(s2.x, s2.y);
              return (c1 && c1.type === CellType.Floor) && (c2 && c2.type === CellType.Floor);
          });
      }
  }

  public validate(map: MapDefinition): IMapValidationResult {
    const issues: string[] = [];
    const { width, height, cells, doors, spawnPoints, extraction, objectives } = map;

    if (width <= 0 || height <= 0) {
      issues.push('Map dimensions (width and height) must be positive.');
    }

    const isWithinBounds = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height;

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

    const getCell = (x: number, y: number): Cell | undefined => {
      if (!isWithinBounds(x, y)) return undefined;
      return cellLookup.get(`${x},${y}`);
    };

    if (doors) {
      for (const door of doors) {
        if (!door.id) {
          issues.push('Door found with no ID.');
        }
        if (!door.segment || door.segment.length === 0) {
          issues.push(`Door ${door.id} has no segments defined.`);
          continue;
        }
        if (door.segment.length > 2) { 
          issues.push(`Door ${door.id} has more than 2 segments, which is not supported.`);
        }

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
        if (connectedFloorCells.length === 2) {
          const [p1, p2] = connectedFloorCells;
          const dx = Math.abs(p1.x - p2.x);
          const dy = Math.abs(p1.y - p2.y);
          if (!((dx === 1 && dy === 0) || (dx === 0 && dy === 1))) {
            issues.push(`Door ${door.id} segments at (${p1.x},${p1.y}) and (${p2.x},${p2.y}) are not adjacent.`);
          }
        } else if (connectedFloorCells.length === 1) {
          issues.push(`Door ${door.id} segment defines only one connected floor cell. Doors should span between two adjacent floor cells.`);
        }
      }
    }

    for (const cell of cells) {
        if (cell.type === CellType.Floor) {
            const checkDir = (dir: 'n'|'e'|'s'|'w', nx: number, ny: number, opp: 'n'|'e'|'s'|'w') => {
                if (!cell.walls[dir]) {
                    const n = getCell(nx, ny);
                    if (!n) {
                        issues.push(`Cell (${cell.x},${cell.y}) has open wall '${dir}' to map edge.`);
                    } else if (n.type !== CellType.Floor) {
                        issues.push(`Cell (${cell.x},${cell.y}) has open wall '${dir}' to Void at (${nx},${ny}).`);
                    } else {
                        if (n.walls[opp]) {
                            issues.push(`Wall inconsistency: Cell (${cell.x},${cell.y}) has open '${dir}' wall, but neighbor (${nx},${ny}) has closed '${opp}' wall.`);
                        }
                    }
                }
            };
            
            checkDir('n', cell.x, cell.y - 1, 's');
            checkDir('e', cell.x + 1, cell.y, 'w');
            checkDir('s', cell.x, cell.y + 1, 'n');
            checkDir('w', cell.x - 1, cell.y, 'e');
        }
    }

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

    if (spawnPoints && spawnPoints.length > 0) {
      const visitedCells = new Set<string>();
      const queue: Vector2[] = [];

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
          { x: current.x, y: current.y - 1, wall: 'n' as 'n'|'e'|'s'|'w', oppWall: 's' as 'n'|'e'|'s'|'w' },
          { x: current.x + 1, y: current.y, wall: 'e' as 'n'|'e'|'s'|'w', oppWall: 'w' as 'n'|'e'|'s'|'w' },
          { x: current.x, y: current.y + 1, wall: 's' as 'n'|'e'|'s'|'w', oppWall: 'n' as 'n'|'e'|'s'|'w' },
          { x: current.x - 1, y: current.y, wall: 'w' as 'n'|'e'|'s'|'w', oppWall: 'e' as 'n'|'e'|'s'|'w' }
        ];

        for (const neighbor of neighbors) {
          const neighborCell = getCell(neighbor.x, neighbor.y);
          if (neighborCell && neighborCell.type === CellType.Floor && !visitedCells.has(`${neighbor.x},${neighbor.y}`)) {
            const hasWallBetween = currentCell.walls[neighbor.wall] || neighborCell.walls[neighbor.oppWall];

            let canTraverse = false;
            if (!hasWallBetween) {
              canTraverse = true;
            } else {
              let foundNonBlockingDoor = false;
              if (doors && doors.length > 0) {
                  for (const door of doors) {
                      if (door.segment.length === 2) {
                          const [s1, s2] = door.segment;
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

      for (const cell of cells) {
        if (cell.type === CellType.Floor && !visitedCells.has(`${cell.x},${cell.y}`)) {
          issues.push(`Floor cell at (${cell.x}, ${cell.y}) is not reachable from any spawn point.`);
        }
      }

      if (extraction && !visitedCells.has(`${extraction.x},${extraction.y}`)) {
        issues.push(`Extraction point at (${extraction.x}, ${extraction.y}) is not reachable from any spawn point.`);
      }

      if (objectives) {
        for (const obj of objectives) {
          if (obj.targetCell && !visitedCells.has(`${obj.targetCell.x},${obj.targetCell.y}`)) {
            issues.push(`Objective ${obj.id} target cell at (${obj.targetCell.x}, ${obj.targetCell.y}) is not reachable from any spawn point.`);
          }
        }
      }
    } else if (spawnPoints && spawnPoints.length === 0 && (cells.some(c => c.type === CellType.Floor) || extraction || (objectives?.length ?? 0) > 0)) {
        issues.push('Map has floor cells or important points but no spawn points to check reachability from.');
    }
    
    return { isValid: issues.length === 0, issues };
  }

  public static toAscii(map: MapDefinition): string {
    const { width, height, cells, doors, spawnPoints, extraction, objectives } = map;
    const expandedWidth = width * 2 + 1;
    const expandedHeight = height * 2 + 1;

    const asciiGrid: string[][] = Array.from({ length: expandedHeight }, () => Array(expandedWidth).fill(' '));

    const cellLookup = new Map<string, Cell>();
    cells.forEach(cell => cellLookup.set(`${cell.x},${cell.y}`, cell));

    const getExEy = (x: number, y: number) => ({ ex: x * 2 + 1, ey: y * 2 + 1 });

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = cellLookup.get(`${x},${y}`);
        const { ex, ey } = getExEy(x, y);

        if (cell?.type === CellType.Wall) {
          asciiGrid[ey][ex] = '#'; 
        } else if (cell?.type === CellType.Floor) {
          let cellChar = ' ';
          const isSpawnPoint = spawnPoints?.some(sp => sp.pos.x === x && sp.pos.y === y);
          const isExtraction = extraction && extraction.x === x && extraction.y === y;
          const isObjective = objectives?.some(obj => obj.targetCell?.x === x && obj.targetCell?.y === y);

          if (isSpawnPoint) cellChar = 'S';
          else if (isExtraction) cellChar = 'E';
          else if (isObjective) cellChar = 'O';
          
          asciiGrid[ey][ex] = cellChar;
        }

        if (cell?.walls.n) asciiGrid[ey - 1][ex] = '-';
        if (cell?.walls.e) asciiGrid[ey][ex + 1] = '|';
        if (cell?.walls.s) asciiGrid[ey + 1][ex] = '-';
        if (cell?.walls.w) asciiGrid[ey][ex - 1] = '|';

        const southCell = cellLookup.get(`${x},${y+1}`);
        if (southCell?.walls.n) asciiGrid[ey + 1][ex] = '-';
        const eastCell = cellLookup.get(`${x+1},${y}`);
        if (eastCell?.walls.w) asciiGrid[ey][ex + 1] = '|';
      }
    }

    doors?.forEach(door => {
      if (door.segment.length === 2) {
        const [p1, p2] = door.segment;
        let ex_door, ey_door;

        if (p1.x === p2.x && Math.abs(p1.y - p2.y) === 1) { 
          ex_door = p1.x * 2 + 1;
          ey_door = Math.min(p1.y, p2.y) * 2 + 2; 
          asciiGrid[ey_door][ex_door] = '=';
        } else if (p1.y === p2.y && Math.abs(p1.x - p2.x) === 1) { 
          ex_door = Math.min(p1.x, p2.x) * 2 + 2;
          ey_door = p1.y * 2 + 1;
          asciiGrid[ey_door][ex_door] = 'I';
        }
      }
    });

    for (let x = 0; x < expandedWidth; x++) {
      if (x % 2 === 1) { 
        if (asciiGrid[0][x] === ' ') asciiGrid[0][x] = '-';
        if (asciiGrid[expandedHeight - 1][x] === ' ') asciiGrid[expandedHeight - 1][x] = '-';
      }
    }
    for (let y = 0; y < expandedHeight; y++) {
      if (y % 2 === 1) { 
        if (asciiGrid[y][0] === ' ') asciiGrid[y][0] = '|';
        if (asciiGrid[y][expandedWidth - 1] === ' ') asciiGrid[y][expandedWidth - 1] = '|';
      }
    }

    for (let y = 0; y < expandedHeight; y += 2) {
      for (let x = 0; x < expandedWidth; x += 2) {
        if (asciiGrid[y][x] === ' ') { 
          let wallCount = 0;
          if (y > 0 && ['|', 'I', '#'].includes(asciiGrid[y - 1][x])) wallCount++; 
          if (y < expandedHeight - 1 && ['|', 'I', '#'].includes(asciiGrid[y + 1][x])) wallCount++; 
          if (x > 0 && ['-', '=', '#'].includes(asciiGrid[y][x - 1])) wallCount++; 
          if (x < expandedWidth - 1 && ['-', '=', '#'].includes(asciiGrid[y][x + 1])) wallCount++; 
          
          if (wallCount >= 2) { 
            asciiGrid[y][x] = '+';
          }
        }
      }
    }
    
    return asciiGrid.map(row => row.join('')).join('\n');
  }


  public static assemble(assembly: TileAssembly, library: Record<string, TileDefinition>): MapDefinition {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

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

    assembly.tiles.forEach(tileRef => {
        const def = library[tileRef.tileId];
        if (!def) throw new Error(`Tile definition not found: ${tileRef.tileId}`);
        const { w, h } = getRotatedDimensions(def.width, def.height, tileRef.rotation);
        minX = Math.min(minX, tileRef.x);
        minY = Math.min(minY, tileRef.y);
        maxX = Math.max(maxX, tileRef.x + w - 1);
        maxY = Math.max(maxY, tileRef.y + h - 1);
    });

    if (minX === Infinity) return { width: 1, height: 1, cells: [] };

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

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

    assembly.tiles.forEach(tileRef => {
        const def = library[tileRef.tileId];
        def.cells.forEach(cellDef => {
            const localPos = rotatePoint(cellDef.x, cellDef.y, def.width, def.height, tileRef.rotation);
            const globalX = tileRef.x + localPos.x - minX;
            const globalY = tileRef.y + localPos.y - minY;

            if (globalX < 0 || globalX >= width || globalY < 0 || globalY >= height) return;

            const cellIndex = getCellIndex(globalX, globalY);
            const cell = cells[cellIndex];
            cell.type = CellType.Floor;

            const rotateEdge = (edge: 'n'|'e'|'s'|'w', rot: 0|90|180|270): 'n'|'e'|'s'|'w' => {
                const edges: ('n'|'e'|'s'|'w')[] = ['n', 'e', 's', 'w'];
                const idx = edges.indexOf(edge);
                const shift = rot / 90;
                return edges[(idx + shift) % 4];
            };

            const rotatedOpenEdges = cellDef.openEdges.map(e => rotateEdge(e, tileRef.rotation));

            if (rotatedOpenEdges.includes('n')) cell.walls.n = false;
            if (rotatedOpenEdges.includes('e')) cell.walls.e = false;
            if (rotatedOpenEdges.includes('s')) cell.walls.s = false;
            if (rotatedOpenEdges.includes('w')) cell.walls.w = false;
        });
    });

    const doors: Door[] = assembly.globalDoors?.map((d, i) => ({
        id: d.id,
        orientation: d.orientation,
        state: 'Closed',
        hp: 50, maxHp: 50, openDuration: 1,
        segment: d.orientation === 'Vertical' 
            ? [{ x: d.cell.x - minX - 1, y: d.cell.y - minY }, { x: d.cell.x - minX, y: d.cell.y - minY }]
            : [{ x: d.cell.x - minX, y: d.cell.y - minY - 1 }, { x: d.cell.x - minX, y: d.cell.y - minY }]
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

    return { width, height, cells, doors, spawnPoints, extraction, objectives };
  }

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
    const objectives: ObjectiveDefinition[] = [];
    let extraction: Vector2 | undefined = undefined;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ex = x * 2 + 1;
        const ey = y * 2 + 1;
        
        if (ex >= lines[ey].length) {
             cells.push({ x, y, type: CellType.Wall, walls: { n: true, e: true, s: true, w: true } });
             continue;
        }

        const char = lines[ey][ex];
        const type = char === '#' ? CellType.Wall : CellType.Floor;
        
        cells.push({ x, y, type, walls: { n: false, e: false, s: false, w: false } });

        if (type === CellType.Floor) {
            if (char === 'S') spawnPoints.push({ id: `sp-${spawnPoints.length}`, pos: { x, y }, radius: 1 });
            if (char === 'E') extraction = { x, y };
            if (char === 'O') objectives.push({ id: `obj-${objectives.length}`, kind: 'Recover', targetCell: { x, y } });
        }
      }
    }

    const getCell = (x: number, y: number) => cells.find(c => c.x === x && c.y === y);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const cell = getCell(x, y);
            if (!cell) continue;
            
            const ex = x * 2 + 1;
            const ey = y * 2 + 1;
            const isHWall = (c: string) => ['-', '=', '#'].includes(c);
            const isVWall = (c: string) => ['|', 'I', '#'].includes(c);

            if (ey - 1 >= 0) cell.walls.n = isHWall(lines[ey - 1][ex]);
            if (ey + 1 < expandedHeight) cell.walls.s = isHWall(lines[ey + 1][ex]);
            if (ex + 1 < lines[ey].length) cell.walls.e = isVWall(lines[ey][ex + 1]);
            if (ex - 1 >= 0) cell.walls.w = isVWall(lines[ey][ex - 1]);
        }
    }

    let doorIdCounter = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 1; x < width; x++) { 
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
    for (let y = 1; y < height; y++) { 
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

    return { width, height, cells, doors, spawnPoints, extraction, objectives };
  }
}