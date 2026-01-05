import {
  MapDefinition,
  CellType,
  SpawnPoint,
  Objective,
  Cell,
  IMapValidationResult,
  Door,
  Vector2,
  TileAssembly,
  TileDefinition,
  MapGeneratorType,
  ObjectiveDefinition,
  WallDefinition,
} from "../shared/types";
import { PRNG } from "../shared/PRNG";
import { TreeShipGenerator } from "./generators/TreeShipGenerator";
import { SpaceshipGenerator } from "./generators/SpaceshipGenerator";
import { DenseShipGenerator } from "./generators/DenseShipGenerator";
import { Graph, Direction } from "./Graph";

export class MapGenerator {
  private prng: PRNG;
  private seed: number;

  constructor(seed: number) {
    this.prng = new PRNG(seed);
    this.seed = seed;
  }

  public generate(
    width: number,
    height: number,
    type: MapGeneratorType = MapGeneratorType.Procedural,
    spawnPointCount?: number,
  ): MapDefinition {
    const spCount = spawnPointCount ?? 1;
    let map: MapDefinition;
    switch (type) {
      case MapGeneratorType.TreeShip:
        map = new TreeShipGenerator(this.seed, width, height).generate(spCount);
        break;
      case MapGeneratorType.Procedural:
        map = new SpaceshipGenerator(this.seed, width, height).generate(
          spCount,
        );
        break;
      case MapGeneratorType.DenseShip:
        map = new DenseShipGenerator(this.seed, width, height).generate(
          spCount,
        );
        break;
      default:
        map = new SpaceshipGenerator(this.seed, width, height).generate(
          spCount,
        );
    }
    map.generatorName = type;
    return map;
  }

  public load(mapDefinition: MapDefinition): MapDefinition {
    mapDefinition.generatorName =
      mapDefinition.generatorName || MapGeneratorType.Static;
    return mapDefinition;
  }

  public static sanitize(map: MapDefinition): void {
    const graph = new Graph(map);
    const { width, height, spawnPoints } = map;

    // 1. Identify all reachable Floor cells from SpawnPoints
    const reachable = new Set<string>();
    const queue: { x: number; y: number }[] = [];

    if (spawnPoints) {
      for (const sp of spawnPoints) {
        queue.push(sp.pos);
        reachable.add(`${sp.pos.x},${sp.pos.y}`);
      }
    }

    let head = 0;
    while (head < queue.length) {
      const { x, y } = queue[head++];
      const cell = graph.cells[y][x];
      if (cell.type !== CellType.Floor) continue;

      const dirs: { dx: number; dy: number; d: Direction }[] = [
        { dx: 0, dy: -1, d: "n" },
        { dx: 1, dy: 0, d: "e" },
        { dx: 0, dy: 1, d: "s" },
        { dx: -1, dy: 0, d: "w" },
      ];

      for (const { dx, dy, d } of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        const boundary = cell.edges[d];
        // Traverse if NO wall OR if there is a Door
        if (boundary && (!boundary.isWall || boundary.doorId)) {
          const nKey = `${nx},${ny}`;
          if (!reachable.has(nKey)) {
            const nCell = graph.cells[ny][nx];
            if (nCell.type === CellType.Floor) {
              reachable.add(nKey);
              queue.push({ x: nx, y: ny });
            }
          }
        }
      }
    }

    // 2. Mark unreachable as Void and Reset Walls
    for (const cellDef of map.cells) {
      const key = `${cellDef.x},${cellDef.y}`;
      if (reachable.has(key)) {
        cellDef.type = CellType.Floor;
      } else {
        cellDef.type = CellType.Wall;
      }
    }

    // 3. Re-build map.walls from Graph (ensuring unreachable cells are walled off)
    const newWalls: WallDefinition[] = [];
    for (const b of graph.getAllBoundaries()) {
      const c1 = graph.cells[b.y1]?.[b.x1];
      const c2 = graph.cells[b.y2]?.[b.x2];

      let isWall = b.isWall;
      // If neighbor is outside or either cell is now a Wall (Void), it must be a wall
      if (
        !c1 ||
        !c2 ||
        c1.type === CellType.Wall ||
        c2.type === CellType.Wall
      ) {
        isWall = true;
      }

      if (isWall && !b.doorId) {
        newWalls.push({ p1: { x: b.x1, y: b.y1 }, p2: { x: b.x2, y: b.y2 } });
      }
    }
    map.walls = newWalls;

    // 4. Remove Doors connected to Void
    if (map.doors) {
      map.doors = map.doors.filter((door) => {
        if (door.segment.length !== 2) return false;
        const [s1, s2] = door.segment;
        const c1 = map.cells[s1.y * width + s1.x];
        const c2 = map.cells[s2.y * width + s2.x];
        return (
          c1 && c1.type === CellType.Floor && c2 && c2.type === CellType.Floor
        );
      });
    }
  }

  public validate(map: MapDefinition): IMapValidationResult {
    const issues: string[] = [];
    const { width, height, cells, doors, spawnPoints, extraction, objectives } =
      map;
    const graph = new Graph(map);

    if (width <= 0 || height <= 0) {
      issues.push("Map dimensions (width and height) must be positive.");
    }

    const isWithinBounds = (x: number, y: number) =>
      x >= 0 && x < width && y >= 0 && y < height;

    const cellLookup = new Set<string>();
    for (const cell of cells) {
      const key = `${cell.x},${cell.y}`;
      if (cellLookup.has(key)) {
        issues.push(`Duplicate cell definition at (${cell.x}, ${cell.y}).`);
      }
      cellLookup.add(key);

      if (!isWithinBounds(cell.x, cell.y)) {
        issues.push(`Cell at (${cell.x}, ${cell.y}) is out of map bounds.`);
      }
    }

    if (cells.length !== width * height) {
      issues.push(
        `Number of cells (${cells.length}) does not match map dimensions (${width}x${height} = ${width * height}).`,
      );
    }

    if (doors) {
      for (const door of doors) {
        if (!door.id) issues.push("Door found with no ID.");
        if (!door.segment || door.segment.length !== 2) {
          issues.push(`Door ${door.id} must have exactly 2 segments.`);
          continue;
        }

        for (const segmentPart of door.segment) {
          if (!isWithinBounds(segmentPart.x, segmentPart.y)) {
            issues.push(
              `Door ${door.id} segment at (${segmentPart.x}, ${segmentPart.y}) is out of map bounds.`,
            );
          } else {
            const cell = graph.cells[segmentPart.y][segmentPart.x];
            if (cell.type !== CellType.Floor) {
              issues.push(
                `Door ${door.id} segment at (${segmentPart.x}, ${segmentPart.y}) is not a Floor cell.`,
              );
            }
          }
        }
      }
    }

    for (const b of graph.getAllBoundaries()) {
      const c1 = graph.cells[b.y1]?.[b.x1];
      const c2 = graph.cells[b.y2]?.[b.x2];
      if (!b.isWall) {
        if (
          !c1 ||
          !c2 ||
          c1.type !== CellType.Floor ||
          c2.type !== CellType.Floor
        ) {
          issues.push(
            `Open boundary at (${b.x1},${b.y1})--(${b.x2},${b.y2}) must be between two Floor cells.`,
          );
        }
      }
    }

    if (!spawnPoints || spawnPoints.length === 0) {
      issues.push("No spawn points defined.");
    } else {
      for (const sp of spawnPoints) {
        if (!isWithinBounds(sp.pos.x, sp.pos.y)) {
          issues.push(
            `Spawn point ${sp.id} at (${sp.pos.x}, ${sp.pos.y}) is out of map bounds.`,
          );
        } else {
          const cell = graph.cells[sp.pos.y][sp.pos.x];
          if (cell.type !== CellType.Floor) {
            issues.push(
              `Spawn point ${sp.id} at (${sp.pos.x}, ${sp.pos.y}) is not on a Floor cell.`,
            );
          }
          if (!cell.roomId || cell.roomId.startsWith("corridor-")) {
            issues.push(
              `Enemy spawn point ${sp.id} at (${sp.pos.x}, ${sp.pos.y}) must be in a room, not a corridor.`,
            );
          }
        }
      }
    }

    if (extraction) {
      if (!isWithinBounds(extraction.x, extraction.y)) {
        issues.push(
          `Extraction point at (${extraction.x}, ${extraction.y}) is out of map bounds.`,
        );
      } else {
        const cell = graph.cells[extraction.y][extraction.x];
        if (cell.type !== CellType.Floor) {
          issues.push(
            `Extraction point at (${extraction.x}, ${extraction.y}) is not on a Floor cell.`,
          );
        }
        if (!cell.roomId || cell.roomId.startsWith("corridor-")) {
          issues.push(
            `Extraction point at (${extraction.x}, ${extraction.y}) must be in a room, not a corridor.`,
          );
        }
      }
    }

    if (map.objectives) {
      for (const obj of map.objectives) {
        if (obj.targetCell) {
          if (!isWithinBounds(obj.targetCell.x, obj.targetCell.y)) {
            issues.push(
              `Objective ${obj.id} at (${obj.targetCell.x}, ${obj.targetCell.y}) is out of map bounds.`,
            );
          } else {
            const cell = graph.cells[obj.targetCell.y][obj.targetCell.x];
            if (cell.type !== CellType.Floor) {
              issues.push(
                `Objective ${obj.id} at (${obj.targetCell.x}, ${obj.targetCell.y}) is not on a Floor cell.`,
              );
            }
            if (!cell.roomId || cell.roomId.startsWith("corridor-")) {
              issues.push(
                `Objective ${obj.id} at (${obj.targetCell.x}, ${obj.targetCell.y}) must be in a room, not a corridor.`,
              );
            }
          }
        }
      }
    }

    if (map.squadSpawn) {
      const ss = map.squadSpawn;
      if (!isWithinBounds(ss.x, ss.y)) {
        issues.push(
          `Squad spawn point at (${ss.x}, ${ss.y}) is out of map bounds.`,
        );
      } else {
        const cell = graph.cells[ss.y][ss.x];
        if (cell.type !== CellType.Floor) {
          issues.push(
            `Squad spawn point at (${ss.x}, ${ss.y}) is not on a Floor cell.`,
          );
        }
        if (!cell.roomId || cell.roomId.startsWith("corridor-")) {
          issues.push(
            `Squad spawn point at (${ss.x}, ${ss.y}) must be in a room, not a corridor.`,
          );
        }
      }
    }

    if (map.squadSpawns) {
      for (const ss of map.squadSpawns) {
        if (!isWithinBounds(ss.x, ss.y)) {
          issues.push(
            `Squad spawn point at (${ss.x}, ${ss.y}) is out of map bounds.`,
          );
        } else {
          const cell = graph.cells[ss.y][ss.x];
          if (cell.type !== CellType.Floor) {
            issues.push(
              `Squad spawn point at (${ss.x}, ${ss.y}) is not on a Floor cell.`,
            );
          }
          if (!cell.roomId || cell.roomId.startsWith("corridor-")) {
            issues.push(
              `Squad spawn point at (${ss.x}, ${ss.y}) must be in a room, not a corridor.`,
            );
          }
        }
      }
    }

    // Mutually exclusive rooms for major entities and objectives
    const enemySpawnRooms = new Set<string>();
    if (spawnPoints) {
      for (const sp of spawnPoints) {
        if (isWithinBounds(sp.pos.x, sp.pos.y)) {
          const cell = graph.cells[sp.pos.y][sp.pos.x];
          if (cell.roomId) enemySpawnRooms.add(cell.roomId);
        }
      }
    }

    const squadSpawnRooms = new Set<string>();
    if (map.squadSpawn && isWithinBounds(map.squadSpawn.x, map.squadSpawn.y)) {
      const cell = graph.cells[map.squadSpawn.y][map.squadSpawn.x];
      if (cell.roomId) squadSpawnRooms.add(cell.roomId);
    }
    if (map.squadSpawns) {
      for (const ss of map.squadSpawns) {
        if (isWithinBounds(ss.x, ss.y)) {
          const cell = graph.cells[ss.y][ss.x];
          if (cell.roomId) squadSpawnRooms.add(cell.roomId);
        }
      }
    }

    let extractionRoomId: string | undefined;
    if (extraction && isWithinBounds(extraction.x, extraction.y)) {
      const cell = graph.cells[extraction.y][extraction.x];
      extractionRoomId = cell.roomId;
    }

    const objectiveRoomIds = new Set<string>();
    if (map.objectives) {
      for (const obj of map.objectives) {
        if (
          obj.targetCell &&
          isWithinBounds(obj.targetCell.x, obj.targetCell.y)
        ) {
          const cell = graph.cells[obj.targetCell.y][obj.targetCell.x];
          if (cell.roomId) objectiveRoomIds.add(cell.roomId);
        }
      }
    }

    // Major Entity mutual exclusivity
    for (const roomId of squadSpawnRooms) {
      if (enemySpawnRooms.has(roomId)) {
        issues.push(
          `Squad and Enemy spawn points share the same room: ${roomId}`,
        );
      }
      if (extractionRoomId === roomId) {
        issues.push(
          `Squad spawn and Extraction share the same room: ${roomId}`,
        );
      }
      if (objectiveRoomIds.has(roomId)) {
        issues.push(`Squad spawn and Objective share the same room: ${roomId}`);
      }
    }

    for (const roomId of enemySpawnRooms) {
      if (extractionRoomId === roomId) {
        issues.push(
          `Enemy spawn and Extraction share the same room: ${roomId}`,
        );
      }
    }

    // Objective isolation on large maps
    const isSmallMap = width * height <= 25;
    if (!isSmallMap) {
      for (const roomId of objectiveRoomIds) {
        if (enemySpawnRooms.has(roomId)) {
          issues.push(
            `Objective and Enemy spawn share the same room on large map: ${roomId}`,
          );
        }
        if (extractionRoomId === roomId) {
          issues.push(
            `Objective and Extraction share the same room on large map: ${roomId}`,
          );
        }
      }
    }

    // Cell Exclusivity (Section 8.5)
    const occupiedCells = new Map<string, string>();
    const checkExclusivity = (pos: Vector2, type: string) => {
      const key = `${pos.x},${pos.y}`;
      if (occupiedCells.has(key)) {
        issues.push(
          `${type} at (${pos.x}, ${pos.y}) overlaps with ${occupiedCells.get(key)}.`,
        );
      } else {
        occupiedCells.set(key, type);
      }
    };

    if (map.squadSpawn) checkExclusivity(map.squadSpawn, "Squad spawn");
    if (map.squadSpawns) {
      for (const ss of map.squadSpawns) {
        // Skip if it's the same as squadSpawn to avoid false positives
        if (
          map.squadSpawn &&
          ss.x === map.squadSpawn.x &&
          ss.y === map.squadSpawn.y
        )
          continue;
        checkExclusivity(ss, "Squad spawn");
      }
    }
    if (spawnPoints) {
      for (const sp of spawnPoints) {
        checkExclusivity(sp.pos, `Enemy spawn ${sp.id}`);
      }
    }
    if (extraction) checkExclusivity(extraction, "Extraction point");
    if (objectives) {
      for (const obj of objectives) {
        if (obj.targetCell)
          checkExclusivity(obj.targetCell, `Objective ${obj.id}`);
      }
    }

    if (spawnPoints && spawnPoints.length > 0) {
      const visitedCells = new Set<string>();
      const queue: Vector2[] = [];

      for (const sp of spawnPoints) {
        queue.push(sp.pos);
        visitedCells.add(`${sp.pos.x},${sp.pos.y}`);
      }

      let head = 0;
      while (head < queue.length) {
        const current = queue[head++];
        const cell = graph.cells[current.y]?.[current.x];
        if (!cell) continue;

        const dirs: Direction[] = ["n", "e", "s", "w"];
        for (const d of dirs) {
          const boundary = cell.edges[d];
          if (boundary) {
            let canTraverse = !boundary.isWall;
            if (boundary.doorId && doors) {
              const door = doors.find((dr) => dr.id === boundary.doorId);
              if (door && door.state !== "Locked") {
                canTraverse = true;
              }
            }

            if (canTraverse) {
              const nx =
                d === "e"
                  ? current.x + 1
                  : d === "w"
                    ? current.x - 1
                    : current.x;
              const ny =
                d === "s"
                  ? current.y + 1
                  : d === "n"
                    ? current.y - 1
                    : current.y;

              if (isWithinBounds(nx, ny) && !visitedCells.has(`${nx},${ny}`)) {
                const nCell = graph.cells[ny]?.[nx];
                if (nCell && nCell.type === CellType.Floor) {
                  visitedCells.add(`${nx},${ny}`);
                  queue.push({ x: nx, y: ny });
                }
              }
            }
          }
        }
      }

      for (const cellDef of map.cells) {
        if (
          cellDef.type === CellType.Floor &&
          !visitedCells.has(`${cellDef.x},${cellDef.y}`)
        ) {
          issues.push(
            `Floor cell at (${cellDef.x}, ${cellDef.y}) is not reachable from any spawn point.`,
          );
        }
      }
    }

    // Squad reachability check
    const squadStart =
      map.squadSpawn || (map.squadSpawns && map.squadSpawns[0]);
    if (squadStart) {
      const visitedFromSquad = new Set<string>();
      const queue: Vector2[] = [squadStart];
      visitedFromSquad.add(`${squadStart.x},${squadStart.y}`);

      let head = 0;
      while (head < queue.length) {
        const current = queue[head++];
        const cell = graph.cells[current.y]?.[current.x];
        if (!cell) continue;

        const dirs: Direction[] = ["n", "e", "s", "w"];
        for (const d of dirs) {
          const boundary = cell.edges[d];
          if (boundary) {
            let canTraverse = !boundary.isWall;
            if (boundary.doorId && doors) {
              const door = doors.find((dr) => dr.id === boundary.doorId);
              if (door && door.state !== "Locked") {
                canTraverse = true;
              }
            }

            if (canTraverse) {
              const nx =
                d === "e"
                  ? current.x + 1
                  : d === "w"
                    ? current.x - 1
                    : current.x;
              const ny =
                d === "s"
                  ? current.y + 1
                  : d === "n"
                    ? current.y - 1
                    : current.y;

              if (
                isWithinBounds(nx, ny) &&
                !visitedFromSquad.has(`${nx},${ny}`)
              ) {
                const nCell = graph.cells[ny]?.[nx];
                if (nCell && nCell.type === CellType.Floor) {
                  visitedFromSquad.add(`${nx},${ny}`);
                  queue.push({ x: nx, y: ny });
                }
              }
            }
          }
        }
      }

      if (
        extraction &&
        !visitedFromSquad.has(`${extraction.x},${extraction.y}`)
      ) {
        issues.push(
          `Extraction point at (${extraction.x}, ${extraction.y}) is not reachable from squad spawn.`,
        );
      }

      if (objectives) {
        for (const obj of objectives) {
          if (
            obj.targetCell &&
            !visitedFromSquad.has(`${obj.targetCell.x},${obj.targetCell.y}`)
          ) {
            issues.push(
              `Objective ${obj.id} at (${obj.targetCell.x}, ${obj.targetCell.y}) is not reachable from squad spawn.`,
            );
          }
        }
      }
    }

    return { isValid: issues.length === 0, issues };
  }

  public static toAscii(map: MapDefinition): string {
    const graph = new Graph(map);
    const { width, height, spawnPoints, extraction, objectives } = map;
    const expandedWidth = width * 2 + 1;
    const expandedHeight = height * 2 + 1;
    const asciiGrid: string[][] = Array.from({ length: expandedHeight }, () =>
      Array(expandedWidth).fill(" "),
    );

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = graph.cells[y][x];
        const ex = x * 2 + 1;
        const ey = y * 2 + 1;

        if (cell.type === CellType.Wall) {
          asciiGrid[ey][ex] = "#";
        } else {
          let cellChar = " ";
          const isSquadSpawn =
            (map.squadSpawn?.x === x && map.squadSpawn?.y === y) ||
            map.squadSpawns?.some((ss) => ss.x === x && ss.y === y);

          if (isSquadSpawn) cellChar = "P";
          else if (spawnPoints?.some((sp) => sp.pos.x === x && sp.pos.y === y))
            cellChar = "S";
          else if (extraction && extraction.x === x && extraction.y === y)
            cellChar = "E";
          else if (
            objectives?.some(
              (obj) => obj.targetCell?.x === x && obj.targetCell?.y === y,
            )
          )
            cellChar = "O";
          asciiGrid[ey][ex] = cellChar;
        }

        const n = cell.edges.n;
        if (n?.isWall) asciiGrid[ey - 1][ex] = n.doorId ? "=" : "-";
        const e = cell.edges.e;
        if (e?.isWall) asciiGrid[ey][ex + 1] = e.doorId ? "I" : "|";
        const s = cell.edges.s;
        if (s?.isWall) asciiGrid[ey + 1][ex] = s.doorId ? "=" : "-";
        const w = cell.edges.w;
        if (w?.isWall) asciiGrid[ey][ex - 1] = w.doorId ? "I" : "|";
      }
    }

    // Add map border
    for (let x = 0; x < expandedWidth; x++) {
      if (x % 2 === 1) {
        if (asciiGrid[0][x] === " ") asciiGrid[0][x] = "-";
        if (asciiGrid[expandedHeight - 1][x] === " ")
          asciiGrid[expandedHeight - 1][x] = "-";
      }
    }
    for (let y = 0; y < expandedHeight; y++) {
      if (y % 2 === 1) {
        if (asciiGrid[y][0] === " ") asciiGrid[y][0] = "|";
        if (asciiGrid[y][expandedWidth - 1] === " ")
          asciiGrid[y][expandedWidth - 1] = "|";
      }
    }

    // Corners
    for (let y = 0; y < expandedHeight; y += 2) {
      for (let x = 0; x < expandedWidth; x += 2) {
        if (asciiGrid[y][x] === " ") {
          let wallCount = 0;
          if (y > 0 && ["|", "I", "#"].includes(asciiGrid[y - 1][x]))
            wallCount++;
          if (
            y < expandedHeight - 1 &&
            ["|", "I", "#"].includes(asciiGrid[y + 1][x])
          )
            wallCount++;
          if (x > 0 && ["-", "=", "#"].includes(asciiGrid[y][x - 1]))
            wallCount++;
          if (
            x < expandedWidth - 1 &&
            ["-", "=", "#"].includes(asciiGrid[y][x + 1])
          )
            wallCount++;
          if (wallCount >= 2) asciiGrid[y][x] = "+";
        }
      }
    }

    return asciiGrid.map((row) => row.join("")).join("\n");
  }

  public static assemble(
    assembly: TileAssembly,
    library: Record<string, TileDefinition>,
  ): MapDefinition {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    const rotatePoint = (
      px: number,
      py: number,
      w: number,
      h: number,
      rot: 0 | 90 | 180 | 270,
    ): { x: number; y: number } => {
      switch (rot) {
        case 0:
          return { x: px, y: py };
        case 90:
          return { x: h - 1 - py, y: px };
        case 180:
          return { x: w - 1 - px, y: h - 1 - py };
        case 270:
          return { x: py, y: w - 1 - px };
      }
    };

    const getRotatedDimensions = (
      w: number,
      h: number,
      rot: 0 | 90 | 180 | 270,
    ): { w: number; h: number } => {
      if (rot === 90 || rot === 270) return { w: h, h: w };
      return { w, h };
    };

    assembly.tiles.forEach((tileRef) => {
      const def = library[tileRef.tileId];
      const { w, h } = getRotatedDimensions(
        def.width,
        def.height,
        tileRef.rotation,
      );
      minX = Math.min(minX, tileRef.x);
      minY = Math.min(minY, tileRef.y);
      maxX = Math.max(maxX, tileRef.x + w - 1);
      maxY = Math.max(maxY, tileRef.y + h - 1);
    });

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const cells: Cell[] = Array(width * height)
      .fill(null)
      .map((_, i) => ({
        x: i % width,
        y: Math.floor(i / width),
        type: CellType.Wall,
      }));

    const openBoundaries = new Set<string>();
    const getBoundaryKey = (x1: number, y1: number, x2: number, y2: number) =>
      [`${x1},${y1}`, `${x2},${y2}`].sort().join("--");

    assembly.tiles.forEach((tileRef, tileIdx) => {
      const def = library[tileRef.tileId];
      const isRoom = def.id.toLowerCase().includes("room");
      const roomId = isRoom
        ? `room-tile-${tileIdx}-${def.id}`
        : `corridor-tile-${tileIdx}-${def.id}`;

      def.cells.forEach((cellDef) => {
        const localPos = rotatePoint(
          cellDef.x,
          cellDef.y,
          def.width,
          def.height,
          tileRef.rotation,
        );
        const gx = tileRef.x + localPos.x - minX;
        const gy = tileRef.y + localPos.y - minY;
        if (gx < 0 || gx >= width || gy < 0 || gy >= height) return;
        const cell = cells[gy * width + gx];
        cell.type = CellType.Floor;
        cell.roomId = roomId;

        cellDef.openEdges.forEach((edge) => {
          const rotateEdge = (e: Direction, rot: number): Direction => {
            const edges: Direction[] = ["n", "e", "s", "w"];
            return edges[(edges.indexOf(e) + rot / 90) % 4];
          };
          const re = rotateEdge(edge as Direction, tileRef.rotation);
          const nx = re === "e" ? gx + 1 : re === "w" ? gx - 1 : gx;
          const ny = re === "s" ? gy + 1 : re === "n" ? gy - 1 : gy;
          openBoundaries.add(getBoundaryKey(gx, gy, nx, ny));
        });
      });
    });

    const walls: WallDefinition[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const neighbors = [
          { nx: x + 1, ny: y },
          { nx: x, ny: y + 1 },
        ];
        for (const { nx, ny } of neighbors) {
          const key = getBoundaryKey(x, y, nx, ny);
          if (!openBoundaries.has(key)) {
            walls.push({ p1: { x, y }, p2: { x: nx, y: ny } });
          }
        }
        // Borders
        if (x === 0) walls.push({ p1: { x: -1, y }, p2: { x: 0, y } });
        if (x === width - 1) walls.push({ p1: { x, y }, p2: { x: x + 1, y } });
        if (y === 0) walls.push({ p1: { x, y: -1 }, p2: { x, y: 0 } });
        if (y === height - 1) walls.push({ p1: { x, y }, p2: { x, y: y + 1 } });
      }
    }

    const doors: Door[] =
      assembly.globalDoors?.map((d) => ({
        id: d.id,
        orientation: d.orientation,
        state: "Closed",
        hp: 50,
        maxHp: 50,
        openDuration: 1,
        segment:
          d.orientation === "Vertical"
            ? [
                { x: d.cell.x - minX - 1, y: d.cell.y - minY },
                { x: d.cell.x - minX, y: d.cell.y - minY },
              ]
            : [
                { x: d.cell.x - minX, y: d.cell.y - minY - 1 },
                { x: d.cell.x - minX, y: d.cell.y - minY },
              ],
      })) || [];

    if (assembly.tileDoors) {
      assembly.tileDoors.forEach((td) => {
        const tileRef = assembly.tiles[td.tileIndex];
        if (!tileRef) return;
        const def = library[tileRef.tileId];
        if (!def || !def.doorSockets) return;
        const socket = def.doorSockets[td.socketIndex];
        if (!socket) return;

        const localPos = rotatePoint(
          socket.x,
          socket.y,
          def.width,
          def.height,
          tileRef.rotation,
        );
        const gx = tileRef.x + localPos.x - minX;
        const gy = tileRef.y + localPos.y - minY;

        const rotateEdge = (e: Direction, rot: number): Direction => {
          const edges: Direction[] = ["n", "e", "s", "w"];
          return edges[(edges.indexOf(e) + rot / 90) % 4];
        };
        const re = rotateEdge(socket.edge as Direction, tileRef.rotation);

        const orientation =
          re === "e" || re === "w" ? "Vertical" : "Horizontal";
        const segment =
          orientation === "Vertical"
            ? re === "e"
              ? [
                  { x: gx, y: gy },
                  { x: gx + 1, y: gy },
                ]
              : [
                  { x: gx - 1, y: gy },
                  { x: gx, y: gy },
                ]
            : re === "s"
              ? [
                  { x: gx, y: gy },
                  { x: gx, y: gy + 1 },
                ]
              : [
                  { x: gx, y: gy - 1 },
                  { x: gx, y: gy },
                ];

        doors.push({
          id: td.id,
          orientation,
          state: "Closed",
          hp: 50,
          maxHp: 50,
          openDuration: 1,
          segment,
        });
      });
    }

    return {
      width,
      height,
      cells,
      walls,
      doors,
      spawnPoints:
        assembly.globalSpawnPoints?.map((sp) => ({
          id: sp.id,
          pos: { x: sp.cell.x - minX, y: sp.cell.y - minY },
          radius: 1,
        })) || [],
      squadSpawn: assembly.globalSquadSpawn
        ? {
            x: assembly.globalSquadSpawn.cell.x - minX,
            y: assembly.globalSquadSpawn.cell.y - minY,
          }
        : undefined,
      extraction: assembly.globalExtraction
        ? {
            x: assembly.globalExtraction.cell.x - minX,
            y: assembly.globalExtraction.cell.y - minY,
          }
        : undefined,
      objectives:
        assembly.globalObjectives?.map((obj) => ({
          id: obj.id,
          kind: obj.kind,
          state: "Pending" as const,
          targetCell: { x: obj.cell.x - minX, y: obj.cell.y - minY },
        })) || [],
    };
  }

  public static fromAscii(asciiMap: string): MapDefinition {
    const lines = asciiMap.split("\n").filter((line) => line.length > 0);
    const expandedHeight = lines.length;
    const expandedWidth = lines[0].length;
    const height = Math.floor((expandedHeight - 1) / 2);
    const width = Math.floor((expandedWidth - 1) / 2);

    const cells: Cell[] = [];
    const walls: WallDefinition[] = [];
    const doors: Door[] = [];
    const spawnPoints: SpawnPoint[] = [];
    const objectives: ObjectiveDefinition[] = [];
    let extraction: Vector2 | undefined = undefined;
    let squadSpawn: Vector2 | undefined = undefined;
    const squadSpawns: Vector2[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ex = x * 2 + 1;
        const ey = y * 2 + 1;
        const char = lines[ey][ex];
        cells.push({
          x,
          y,
          type: char === "#" ? CellType.Wall : CellType.Floor,
        });
        if (char === "S")
          spawnPoints.push({
            id: `sp-${spawnPoints.length}`,
            pos: { x, y },
            radius: 1,
          });
        if (char === "P") {
          squadSpawns.push({ x, y });
          if (!squadSpawn) squadSpawn = { x, y };
        }
        if (char === "E") extraction = { x, y };
        if (char === "O")
          objectives.push({
            id: `obj-${objectives.length}`,
            kind: "Recover",
            targetCell: { x, y },
          });

        // Check walls to the right and bottom
        if (x < width - 1) {
          const wallChar = lines[ey][ex + 1];
          if (wallChar === "|")
            walls.push({ p1: { x, y }, p2: { x: x + 1, y } });
          else if (wallChar === "I")
            doors.push({
              id: `d-${doors.length}`,
              orientation: "Vertical",
              state: "Closed",
              hp: 50,
              maxHp: 50,
              openDuration: 1,
              segment: [
                { x, y },
                { x: x + 1, y },
              ],
            });
        }
        if (y < height - 1) {
          const wallChar = lines[ey + 1][ex];
          if (wallChar === "-")
            walls.push({ p1: { x, y }, p2: { x, y: y + 1 } });
          else if (wallChar === "=")
            doors.push({
              id: `d-${doors.length}`,
              orientation: "Horizontal",
              state: "Closed",
              hp: 50,
              maxHp: 50,
              openDuration: 1,
              segment: [
                { x, y },
                { x, y: y + 1 },
              ],
            });
        }
      }
    }
    const map: MapDefinition = {
      width,
      height,
      cells,
      walls,
      doors,
      spawnPoints,
      squadSpawn,
      squadSpawns,
      extraction,
      objectives,
    };

    // Post-process to assign roomIds via flood fill
    const graph = new Graph(map);
    const visited = new Set<string>();
    let roomCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cellIdx = y * width + x;
        if (
          cells[cellIdx].type === CellType.Floor &&
          !visited.has(`${x},${y}`)
        ) {
          roomCount++;
          const roomId = `room-${roomCount}`;
          const queue: Vector2[] = [{ x, y }];
          visited.add(`${x},${y}`);

          let head = 0;
          while (head < queue.length) {
            const current = queue[head++];
            const cell = cells[current.y * width + current.x];
            cell.roomId = roomId;

            const neighbors: { dx: number; dy: number; d: Direction }[] = [
              { dx: 0, dy: -1, d: "n" },
              { dx: 1, dy: 0, d: "e" },
              { dx: 0, dy: 1, d: "s" },
              { dx: -1, dy: 0, d: "w" },
            ];

            for (const { dx, dy, d } of neighbors) {
              const nx = current.x + dx;
              const ny = current.y + dy;
              if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

              const boundary = graph.getBoundary(current.x, current.y, nx, ny);
              // Rooms are separated by walls or doors
              if (boundary && !boundary.isWall && !boundary.doorId) {
                if (!visited.has(`${nx},${ny}`)) {
                  visited.add(`${nx},${ny}`);
                  queue.push({ x: nx, y: ny });
                }
              }
            }
          }
        }
      }
    }

    return map;
  }
}
