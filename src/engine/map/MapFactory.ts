import type {
  MapDefinition,
  MapGenerationConfig,
  TileAssembly,
  TileDefinition,
  Cell,
  WallDefinition,
  Door,
  SpawnPoint,
  Vector2,
  ObjectiveDefinition,
  IMapValidationResult} from "../../shared/types";
import {
  MapGeneratorType,
  CellType,
  BoundaryType
} from "../../shared/types";
import { TreeShipGenerator } from "../generators/TreeShipGenerator";
import { SpaceshipGenerator } from "../generators/SpaceshipGenerator";
import { DenseShipGenerator } from "../generators/DenseShipGenerator";
import type { Direction } from "../Graph";
import { Graph } from "../Graph";
import type { GraphCell } from "../Graph";
import { MapSanitizer } from "./MapSanitizer";
import { MapValidator } from "./MapValidator";
import { PRNG } from "../../shared/PRNG";
import { Logger } from "../../shared/Logger";
import {
  PlacementValidator,
  OccupantType,
} from "../generators/PlacementValidator";

export class MapFactory {
  private config: MapGenerationConfig;

  constructor(config: MapGenerationConfig) {
    this.config = config;
  }

  public generate(): MapDefinition {
    return MapFactory.generate(this.config);
  }

  public static generate(config: MapGenerationConfig): MapDefinition {
    const { width, height, type, seed, spawnPointCount, bonusLootCount } =
      config;
    const spCount = spawnPointCount ?? 1;
    const blCount = bonusLootCount ?? 0;
    let map: MapDefinition;

    switch (type) {
      case MapGeneratorType.TreeShip:
        map = new TreeShipGenerator(seed, width, height).generate(
          spCount,
          blCount,
        );
        break;
      case MapGeneratorType.Procedural:
        map = new SpaceshipGenerator(seed, width, height).generate(
          spCount,
          blCount,
        );
        break;
      case MapGeneratorType.DenseShip:
        map = new DenseShipGenerator(seed, width, height).generate(
          spCount,
          blCount,
        );
        break;
      default:
        map = new SpaceshipGenerator(seed, width, height).generate(
          spCount,
          blCount,
        );
    }

    map.generatorName = type;

    if (bonusLootCount && bonusLootCount > 0) {
      this.placeBonusLoot(map, bonusLootCount, seed);
    }

    // Auto-sanitize after generation
    MapSanitizer.sanitize(map);

    // Auto-validate after generation
    const validation = MapValidator.validate(map);
    if (!validation.isValid) {
      Logger.warn("Generated map has validation issues:", validation.issues);
    }

    return map;
  }

  private static placeBonusLoot(
    map: MapDefinition,
    count: number,
    seed: number,
  ) {
    const prng = new PRNG(seed + 999); // Offset seed to avoid correlation with map structure
    const validator = PlacementValidator.fromMap(map);

    // We only want to place loot in rooms (cells that have a roomId)
    const roomCells = map.cells.filter(
      (c) =>
        c.type === CellType.Floor &&
        c.roomId &&
        !c.roomId.startsWith("corridor-"),
    );
    const available = roomCells.filter((c) => !validator.isCellOccupied(c));

    prng.shuffle(available);

    const loot: Vector2[] = [];
    for (let i = 0; i < Math.min(count, available.length); i++) {
      loot.push({ x: available[i].x, y: available[i].y });
      validator.occupy(available[i], OccupantType.Loot, available[i].roomId);
    }

    map.bonusLoot = loot;
  }

  public validate(map: MapDefinition): IMapValidationResult {
    return MapValidator.validate(map);
  }

  public load(mapDefinition: MapDefinition): MapDefinition {
    mapDefinition.generatorName =
      mapDefinition.generatorName || MapGeneratorType.Static;
    return mapDefinition;
  }

  public static sanitize(map: MapDefinition): void {
    MapSanitizer.sanitize(map);
  }

  private static rotatePoint(
    px: number,
    py: number,
    dims: { w: number; h: number },
    rot: 0 | 90 | 180 | 270,
  ): { x: number; y: number } {
    const { w, h } = dims;
    switch (rot) {
      case 0: return { x: px, y: py };
      case 90: return { x: h - 1 - py, y: px };
      case 180: return { x: w - 1 - px, y: h - 1 - py };
      case 270: return { x: py, y: w - 1 - px };
    }
  }

  private static getRotatedDimensions(w: number, h: number, rot: 0 | 90 | 180 | 270): { w: number; h: number } {
    if (rot === 90 || rot === 270) return { w: h, h: w };
    return { w, h };
  }

  private static rotateEdge(e: Direction, rot: number): Direction {
    const edges: Direction[] = ["n", "e", "s", "w"];
    return edges[(edges.indexOf(e) + rot / 90) % 4];
  }

  private static getBoundaryKey(x1: number, y1: number, x2: number, y2: number): string {
    return [`${x1},${y1}`, `${x2},${y2}`].sort().join("--");
  }

  private static computeAssemblyBounds(
    assembly: TileAssembly,
    library: Record<string, TileDefinition>,
  ): { minX: number; minY: number; width: number; height: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    assembly.tiles.forEach((tileRef) => {
      const def = library[tileRef.tileId];
      const { w, h } = MapFactory.getRotatedDimensions(def.width, def.height, tileRef.rotation);
      minX = Math.min(minX, tileRef.x);
      minY = Math.min(minY, tileRef.y);
      maxX = Math.max(maxX, tileRef.x + w - 1);
      maxY = Math.max(maxY, tileRef.y + h - 1);
    });
    return { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  private static populateCells(params: {
    assembly: TileAssembly;
    library: Record<string, TileDefinition>;
    cells: Cell[];
    openBoundaries: Set<string>;
    minX: number;
    minY: number;
    width: number;
    height: number;
  }): void {
    const { assembly, library, cells, openBoundaries, minX, minY, width, height } = params;
    assembly.tiles.forEach((tileRef, tileIdx) => {
      const def = library[tileRef.tileId];
      const isRoom = def.id.toLowerCase().includes("room");
      const roomId = isRoom ? `room-tile-${tileIdx}-${def.id}` : `corridor-tile-${tileIdx}-${def.id}`;
      def.cells.forEach((cellDef) => {
        const localPos = MapFactory.rotatePoint(cellDef.x, cellDef.y, { w: def.width, h: def.height }, tileRef.rotation);
        const gx = tileRef.x + localPos.x - minX;
        const gy = tileRef.y + localPos.y - minY;
        if (gx < 0 || gx >= width || gy < 0 || gy >= height) return;
        const cell = cells[gy * width + gx];
        cell.type = CellType.Floor;
        cell.roomId = roomId;
        cellDef.openEdges.forEach((edge) => {
          const re = MapFactory.rotateEdge(edge, tileRef.rotation);
          const nx = re === "e" ? gx + 1 : re === "w" ? gx - 1 : gx;
          const ny = re === "s" ? gy + 1 : re === "n" ? gy - 1 : gy;
          openBoundaries.add(MapFactory.getBoundaryKey(gx, gy, nx, ny));
        });
      });
    });
  }

  private static buildAssemblyWalls(
    width: number,
    height: number,
    openBoundaries: Set<string>,
  ): WallDefinition[] {
    const walls: WallDefinition[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const neighbors = [
          { nx: x + 1, ny: y, isVertical: true },
          { nx: x, ny: y + 1, isVertical: false },
        ];
        for (const { nx, ny, isVertical } of neighbors) {
          const key = MapFactory.getBoundaryKey(x, y, nx, ny);
          if (!openBoundaries.has(key)) {
            walls.push(isVertical
              ? { p1: { x: nx, y: ny }, p2: { x: nx, y: ny + 1 } }
              : { p1: { x: nx, y: ny }, p2: { x: nx + 1, y: ny } });
          }
        }
        if (x === 0) walls.push({ p1: { x: 0, y }, p2: { x: 0, y: y + 1 } });
        if (x === width - 1) walls.push({ p1: { x: x + 1, y }, p2: { x: x + 1, y: y + 1 } });
        if (y === 0) walls.push({ p1: { x, y: 0 }, p2: { x: x + 1, y: 0 } });
        if (y === height - 1) walls.push({ p1: { x, y: y + 1 }, p2: { x: x + 1, y: y + 1 } });
      }
    }
    return walls;
  }

  private static buildTileDoors(
    assembly: TileAssembly,
    library: Record<string, TileDefinition>,
    minX: number,
    minY: number,
  ): Door[] {
    const doors: Door[] = [];
    if (!assembly.tileDoors) return doors;
    assembly.tileDoors.forEach((td) => {
      const tileRef = assembly.tiles[td.tileIndex];
      if (!tileRef) return;
      const def = library[tileRef.tileId];
      if (!def?.doorSockets) return;
      const socket = def.doorSockets[td.socketIndex];
      if (!socket) return;
      const localPos = MapFactory.rotatePoint(socket.x, socket.y, { w: def.width, h: def.height }, tileRef.rotation);
      const gx = tileRef.x + localPos.x - minX;
      const gy = tileRef.y + localPos.y - minY;
      const re = MapFactory.rotateEdge(socket.edge, tileRef.rotation);
      const orientation = re === "e" || re === "w" ? "Vertical" : "Horizontal";
      const segment = orientation === "Vertical"
        ? re === "e" ? [{ x: gx, y: gy }, { x: gx + 1, y: gy }] : [{ x: gx - 1, y: gy }, { x: gx, y: gy }]
        : re === "s" ? [{ x: gx, y: gy }, { x: gx, y: gy + 1 }] : [{ x: gx, y: gy - 1 }, { x: gx, y: gy }];
      doors.push({ id: td.id, orientation, state: "Closed", hp: 50, maxHp: 50, openDuration: 1, segment });
    });
    return doors;
  }

  public static assemble(
    assembly: TileAssembly,
    library: Record<string, TileDefinition>,
  ): MapDefinition {
    const { minX, minY, width, height } = MapFactory.computeAssemblyBounds(assembly, library);

    const cells: Cell[] = Array(width * height).fill(null).map((_, i) => ({
      x: i % width,
      y: Math.floor(i / width),
      type: CellType.Void,
    }));

    const openBoundaries = new Set<string>();
    MapFactory.populateCells({ assembly, library, cells, openBoundaries, minX, minY, width, height });

    const walls = MapFactory.buildAssemblyWalls(width, height, openBoundaries);

    const globalDoors: Door[] = assembly.globalDoors?.map((d) => ({
      id: d.id,
      orientation: d.orientation,
      state: "Closed",
      hp: 50,
      maxHp: 50,
      openDuration: 1,
      segment: d.orientation === "Vertical"
        ? [{ x: d.cell.x - minX - 1, y: d.cell.y - minY }, { x: d.cell.x - minX, y: d.cell.y - minY }]
        : [{ x: d.cell.x - minX, y: d.cell.y - minY - 1 }, { x: d.cell.x - minX, y: d.cell.y - minY }],
    })) ?? [];

    const doors = [...globalDoors, ...MapFactory.buildTileDoors(assembly, library, minX, minY)];

    return {
      width,
      height,
      cells: cells.filter((c) => c.type === CellType.Floor),
      walls,
      doors,
      spawnPoints: assembly.globalSpawnPoints?.map((sp) => ({
        id: sp.id,
        pos: { x: sp.cell.x - minX, y: sp.cell.y - minY },
        radius: 1,
      })) ?? [],
      squadSpawn: assembly.globalSquadSpawn
        ? { x: assembly.globalSquadSpawn.cell.x - minX, y: assembly.globalSquadSpawn.cell.y - minY }
        : undefined,
      extraction: assembly.globalExtraction
        ? { x: assembly.globalExtraction.cell.x - minX, y: assembly.globalExtraction.cell.y - minY }
        : undefined,
      objectives: assembly.globalObjectives?.map((obj) => ({
        id: obj.id,
        kind: obj.kind,
        state: "Pending" as const,
        targetCell: { x: obj.cell.x - minX, y: obj.cell.y - minY },
      })) ?? [],
    };
  }

  private static getAsciiCellChar(map: MapDefinition, x: number, y: number): string {
    const { spawnPoints, extraction, objectives } = map;
    const isSquadSpawn = (map.squadSpawn?.x === x && map.squadSpawn?.y === y) ||
      map.squadSpawns?.some((ss) => ss.x === x && ss.y === y);
    if (isSquadSpawn) return "P";
    if (spawnPoints?.some((sp) => sp.pos.x === x && sp.pos.y === y)) return "S";
    if (extraction?.x === x && extraction.y === y) return "E";
    if (objectives?.some((obj) => obj.targetCell?.x === x && obj.targetCell?.y === y)) return "O";
    return " ";
  }

  private static renderCellEdges(
    asciiGrid: string[][],
    cell: GraphCell,
    ex: number,
    ey: number,
  ): void {
    const { n, e, s, w } = cell.edges;
    if (n && n.type !== BoundaryType.Open) asciiGrid[ey - 1][ex] = n.doorId ? "=" : "-";
    if (e && e.type !== BoundaryType.Open) asciiGrid[ey][ex + 1] = e.doorId ? "I" : "|";
    if (s && s.type !== BoundaryType.Open) asciiGrid[ey + 1][ex] = s.doorId ? "=" : "-";
    if (w && w.type !== BoundaryType.Open) asciiGrid[ey][ex - 1] = w.doorId ? "I" : "|";
  }

  private static addAsciiCorners(asciiGrid: string[][], expandedWidth: number, expandedHeight: number): void {
    const vWall = ["|", "I", "#"];
    const hWall = ["-", "=", "#"];
    for (let y = 0; y < expandedHeight; y += 2) {
      for (let x = 0; x < expandedWidth; x += 2) {
        if (asciiGrid[y][x] !== " ") continue;
        let wallCount = 0;
        if (y > 0 && vWall.includes(asciiGrid[y - 1][x])) wallCount++;
        if (y < expandedHeight - 1 && vWall.includes(asciiGrid[y + 1][x])) wallCount++;
        if (x > 0 && hWall.includes(asciiGrid[y][x - 1])) wallCount++;
        if (x < expandedWidth - 1 && hWall.includes(asciiGrid[y][x + 1])) wallCount++;
        if (wallCount >= 2) asciiGrid[y][x] = "+";
      }
    }
  }

  public static toAscii(map: MapDefinition): string {
    const graph = new Graph(map);
    const { width, height } = map;
    const expandedWidth = width * 2 + 1;
    const expandedHeight = height * 2 + 1;
    const asciiGrid: string[][] = Array.from({ length: expandedHeight }, () => Array(expandedWidth).fill(" "));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = graph.cells[y][x];
        const ex = x * 2 + 1;
        const ey = y * 2 + 1;
        asciiGrid[ey][ex] = cell.type === CellType.Void ? "#" : MapFactory.getAsciiCellChar(map, x, y);
        MapFactory.renderCellEdges(asciiGrid, cell, ex, ey);
      }
    }

    // Add map border
    for (let x = 0; x < expandedWidth; x++) {
      if (x % 2 === 1) {
        if (asciiGrid[0][x] === " ") asciiGrid[0][x] = "-";
        if (asciiGrid[expandedHeight - 1][x] === " ") asciiGrid[expandedHeight - 1][x] = "-";
      }
    }
    for (let y = 0; y < expandedHeight; y++) {
      if (y % 2 === 1) {
        if (asciiGrid[y][0] === " ") asciiGrid[y][0] = "|";
        if (asciiGrid[y][expandedWidth - 1] === " ") asciiGrid[y][expandedWidth - 1] = "|";
      }
    }

    MapFactory.addAsciiCorners(asciiGrid, expandedWidth, expandedHeight);
    return asciiGrid.map((row) => row.join("")).join("\n");
  }

  private static parseAsciiCell(
    x: number,
    y: number,
    char: string,
    ctx: { spawnPoints: SpawnPoint[]; squadSpawns: Vector2[]; objectives: ObjectiveDefinition[]; extraction?: Vector2; squadSpawn?: Vector2 },
  ): Cell {
    if (char === "S") ctx.spawnPoints.push({ id: `sp-${ctx.spawnPoints.length}`, pos: { x, y }, radius: 1 });
    if (char === "P") {
      ctx.squadSpawns.push({ x, y });
      ctx.squadSpawn ??= { x, y };
    }
    if (char === "E") ctx.extraction = { x, y };
    if (char === "O") ctx.objectives.push({ id: `obj-${ctx.objectives.length}`, kind: "Recover", targetCell: { x, y } });
    return { x, y, type: char === "#" ? CellType.Void : CellType.Floor };
  }

  private static parseAsciiHorizontalBoundary(
    x: number,
    y: number,
    wallChar: string,
    ctx: { walls: WallDefinition[]; doors: Door[] },
  ): void {
    if (wallChar === "|") {
      ctx.walls.push({ p1: { x: x + 1, y }, p2: { x: x + 1, y: y + 1 } });
    } else if (wallChar === "I") {
      ctx.doors.push({ id: `d-${ctx.doors.length}`, orientation: "Vertical", state: "Closed", hp: 50, maxHp: 50, openDuration: 1, segment: [{ x, y }, { x: x + 1, y }] });
    }
  }

  private static parseAsciiVerticalBoundary(
    x: number,
    y: number,
    wallChar: string,
    ctx: { walls: WallDefinition[]; doors: Door[] },
  ): void {
    if (wallChar === "-") {
      ctx.walls.push({ p1: { x, y: y + 1 }, p2: { x: x + 1, y: y + 1 } });
    } else if (wallChar === "=") {
      ctx.doors.push({ id: `d-${ctx.doors.length}`, orientation: "Horizontal", state: "Closed", hp: 50, maxHp: 50, openDuration: 1, segment: [{ x, y }, { x, y: y + 1 }] });
    }
  }

  private static floodFillRoom(params: {
    start: Vector2; roomId: string; cells: Cell[]; graph: Graph; width: number; height: number; visited: Set<string>;
  }): void {
    const { start, roomId, cells, graph, width, height, visited } = params;
    const DIRS4 = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];
    const queue: Vector2[] = [start];
    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      cells[current.y * width + current.x].roomId = roomId;
      for (const { dx, dy } of DIRS4) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const boundary = graph.getBoundary(current.x, current.y, nx, ny);
        if (boundary?.type === BoundaryType.Open && !visited.has(`${nx},${ny}`)) {
          visited.add(`${nx},${ny}`);
          queue.push({ x: nx, y: ny });
        }
      }
    }
  }

  private static assignRoomIds(cells: Cell[], map: MapDefinition, width: number, height: number): void {
    const graph = new Graph(map);
    const visited = new Set<string>();
    let roomCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cellIdx = y * width + x;
        if (cells[cellIdx].type !== CellType.Floor || visited.has(`${x},${y}`)) continue;
        roomCount++;
        visited.add(`${x},${y}`);
        MapFactory.floodFillRoom({ start: { x, y }, roomId: `room-${roomCount}`, cells, graph, width, height, visited });
      }
    }
  }

  public static fromAscii(asciiMap: string): MapDefinition {
    const lines = asciiMap.split("\n").filter((line) => line.length > 0);
    const expandedHeight = lines.length;
    const expandedWidth = lines[0].length;
    const height = Math.floor((expandedHeight - 1) / 2);
    const width = Math.floor((expandedWidth - 1) / 2);

    const cells: Cell[] = [];
    const ctx = {
      walls: [] as WallDefinition[],
      doors: [] as Door[],
      spawnPoints: [] as SpawnPoint[],
      objectives: [] as ObjectiveDefinition[],
      squadSpawns: [] as Vector2[],
      extraction: undefined as Vector2 | undefined,
      squadSpawn: undefined as Vector2 | undefined,
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ex = x * 2 + 1;
        const ey = y * 2 + 1;
        cells.push(MapFactory.parseAsciiCell(x, y, lines[ey][ex], ctx));
        if (x < width - 1) MapFactory.parseAsciiHorizontalBoundary(x, y, lines[ey][ex + 1], ctx);
        if (y < height - 1) MapFactory.parseAsciiVerticalBoundary(x, y, lines[ey + 1][ex], ctx);
      }
    }

    const map: MapDefinition = {
      width,
      height,
      cells: cells.filter((c) => c.type === CellType.Floor),
      walls: ctx.walls,
      doors: ctx.doors,
      spawnPoints: ctx.spawnPoints,
      squadSpawn: ctx.squadSpawn,
      squadSpawns: ctx.squadSpawns,
      extraction: ctx.extraction,
      objectives: ctx.objectives,
    };

    MapFactory.assignRoomIds(cells, map, width, height);
    return map;
  }
}
