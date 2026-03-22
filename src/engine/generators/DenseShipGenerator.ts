import type {
  MapDefinition,
  Cell,
  Door,
  SpawnPoint,
  ObjectiveDefinition,
  Vector2,
  WallDefinition,
  Direction} from "../../shared/types";
import {
  CellType,
  BoundaryType,
} from "../../shared/types";
import { PRNG } from "../../shared/PRNG";
import { MapSanitizer } from "../map/MapSanitizer";
import { Graph } from "../Graph";
import { PlacementValidator, OccupantType } from "./PlacementValidator";
import { MathUtils } from "../../shared/utils/MathUtils";

type GenCellType = "Void" | "Corridor" | "Room";

export class DenseShipGenerator {
  private prng: PRNG;
  private width: number;
  private height: number;
  private cells: Cell[] = [];
  private walls: Set<string> = new Set();
  private doors: Door[] = [];
  private spawnPoints: SpawnPoint[] = [];
  private squadSpawn?: Vector2;
  private squadSpawns?: Vector2[];
  private objectives: ObjectiveDefinition[] = [];
  private extraction?: Vector2;
  private placementValidator: PlacementValidator = new PlacementValidator();

  // Internal tracking
  private genMap: GenCellType[];
  private roomIds: string[];

  constructor(seed: number, width: number, height: number) {
    this.prng = new PRNG(seed);
    this.width = width;
    this.height = height;
    this.genMap = new Array(width * height).fill("Void");
    this.roomIds = new Array(width * height).fill("");
  }

  private getBoundaryKey(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): string {
    const p1 = `${x1},${y1}`;
    const p2 = `${x2},${y2}`;
    return [p1, p2].sort().join("--");
  }

  /**
   * Generates a high-density "Dense-Ship" map layout designed for maximum floor coverage.
   *
   * The algorithm follows a two-stage approach:
   * 1. Frame Generation (buildFrame): Create a primary "spine" of horizontal and vertical corridors
   *    to establish the map's backbone and guarantee some connectivity.
   * 2. Room Filling (fillPass): Iteratively scan the map and attempt to place rooms of various
   *    shapes adjacent to existing floors (starting from the spine).
   *
   * Features:
   * - Greedy Growth: Rooms expand until they hit an obstacle or the map edge.
   * - High Connectivity: Every new room must connect to a parent floor cell via a door.
   * - High Density: The algorithm continues filling passes until no more rooms can be placed.
   * - Tactical Complexity: Results in a packed, complex layout with many rooms and short connections.
   */
  private buildWallDefinitions(): WallDefinition[] {
    const mapWalls: WallDefinition[] = [];
    this.walls.forEach((key) => {
      const parts = key.split("--").map((p) => p.split(",").map(Number));
      const c1 = { x: parts[0][0], y: parts[0][1] };
      const c2 = { x: parts[1][0], y: parts[1][1] };
      if (c1.x === c2.x) {
        const maxY = Math.max(c1.y, c2.y);
        mapWalls.push({ p1: { x: c1.x, y: maxY }, p2: { x: c1.x + 1, y: maxY } });
      } else {
        const maxX = Math.max(c1.x, c2.x);
        mapWalls.push({ p1: { x: maxX, y: c1.y }, p2: { x: maxX, y: c1.y + 1 } });
      }
    });
    return mapWalls;
  }

  public generate(
    spawnPointCount: number = 2,
    _bonusLootCount: number = 0,
  ): MapDefinition {
    this.placementValidator.clear();
    this.reset();

    // 1. Build Frame (Corridors)
    this.buildFrame();

    // 2. Build Rooms (Depth 1+)
    let placed = true;
    while (placed) {
      placed = this.fillPass();
    }

    // 3. Finalize Map
    this.finalizeCells();
    this.placeEntities(spawnPointCount);

    const map: MapDefinition = {
      width: this.width,
      height: this.height,
      cells: this.cells,
      walls: this.buildWallDefinitions(),
      doors: this.doors,
      spawnPoints: this.spawnPoints,
      squadSpawn: this.squadSpawn,
      squadSpawns: this.squadSpawns,
      extraction: this.extraction,
      objectives: this.objectives,
    };

    MapSanitizer.sanitize(map);
    return map;
  }

  // --- Debug / Golden Output ---
  private renderDebugCells(graph: Graph, grid: string[][]): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const type = this.getGenType(x, y);
        const ex = x * 2 + 1;
        const ey = y * 2 + 1;
        grid[ey][ex] = type === "Corridor" ? "C" : type === "Room" ? "R" : "#";
        this.renderDebugEdges(graph.cells[y][x], grid, ex, ey);
      }
    }
  }

  private renderDebugEdges(cell: { edges: { n?: { type: string; doorId?: string } | null; s?: { type: string; doorId?: string } | null; e?: { type: string; doorId?: string } | null; w?: { type: string; doorId?: string } | null } }, grid: string[][], ex: number, ey: number): void {
    const n = cell.edges.n;
    if (n && n.type !== BoundaryType.Open) grid[ey - 1][ex] = n.doorId ? "=" : "-";
    const s = cell.edges.s;
    if (s && s.type !== BoundaryType.Open) grid[ey + 1][ex] = s.doorId ? "=" : "-";
    const e = cell.edges.e;
    if (e && e.type !== BoundaryType.Open) grid[ey][ex + 1] = e.doorId ? "I" : "|";
    const w = cell.edges.w;
    if (w && w.type !== BoundaryType.Open) grid[ey][ex - 1] = w.doorId ? "I" : "|";
  }

  private renderDebugCorners(grid: string[][], expandedWidth: number, expandedHeight: number): void {
    const vertWall = ["|", "I", "#"];
    const horizWall = ["-", "=", "#"];
    for (let y = 0; y < expandedHeight; y += 2) {
      for (let x = 0; x < expandedWidth; x += 2) {
        if (grid[y][x] !== " ") continue;
        let wallCount = 0;
        if (y > 0 && vertWall.includes(grid[y - 1][x])) wallCount++;
        if (y < expandedHeight - 1 && vertWall.includes(grid[y + 1][x])) wallCount++;
        if (x > 0 && horizWall.includes(grid[y][x - 1])) wallCount++;
        if (x < expandedWidth - 1 && horizWall.includes(grid[y][x + 1])) wallCount++;
        if (wallCount >= 2) grid[y][x] = "+";
      }
    }
  }

  public toDetailedDebugString(): string {
    const map = this.generate();
    const graph = new Graph(map);
    const expandedWidth = this.width * 2 + 1;
    const expandedHeight = this.height * 2 + 1;
    const grid: string[][] = Array.from({ length: expandedHeight }, () =>
      Array(expandedWidth).fill(" "),
    );

    this.renderDebugCells(graph, grid);
    this.renderDebugCorners(grid, expandedWidth, expandedHeight);

    return grid.map((row) => row.join("")).join("\n");
  }

  public toDebugString(): string {
    const symbols: Record<GenCellType, string> = {
      Void: ".",
      Corridor: "C",
      Room: "R",
    };

    let out = "";
    for (let y = 0; y < this.height; y++) {
      let line = "";
      for (let x = 0; x < this.width; x++) {
        line += symbols[this.getGenType(x, y)];
      }
      out += `${line  }\n`;
    }
    return out;
  }

  private reset() {
    this.cells = [];
    this.walls.clear();
    this.doors = [];
    this.spawnPoints = [];
    this.objectives = [];
    this.extraction = undefined;
    this.squadSpawn = undefined;
    this.squadSpawns = undefined;
    this.genMap.fill("Void");
    this.roomIds.fill("");

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cells.push({
          x,
          y,
          type: CellType.Void,
        });
        // Initialize walls
        this.walls.add(this.getBoundaryKey(x, y, x + 1, y));
        this.walls.add(this.getBoundaryKey(x, y, x, y + 1));
        if (x === 0) this.walls.add(this.getBoundaryKey(-1, y, 0, y));
        if (y === 0) this.walls.add(this.getBoundaryKey(x, -1, x, 0));
      }
    }
  }

  private buildFrame(): Vector2[] {
    const corridors: Vector2[] = [];
    const minHLen = Math.ceil(this.width * 0.75);
    const minVLen = Math.ceil(this.height * 0.75);

    const hSpineY = this.prng.nextInt(2, this.height - 3);
    const hSpineLen = this.prng.nextInt(minHLen, this.width);
    const hSpineX = this.prng.nextInt(0, this.width - hSpineLen);

    const hSpineId = "corridor-h-spine";
    for (let x = hSpineX; x < hSpineX + hSpineLen; x++) {
      this.setGenType(x, hSpineY, "Corridor", hSpineId);
      corridors.push({ x, y: hSpineY });
      if (x > hSpineX) this.openWall(x - 1, hSpineY, "e");
    }

    const vSpineX = this.prng.nextInt(
      Math.max(2, hSpineX),
      Math.min(this.width - 3, hSpineX + hSpineLen - 1),
    );
    const vSpineLen = this.prng.nextInt(minVLen, this.height);
    const vSpineY = this.prng.nextInt(0, this.height - vSpineLen);

    let finalVSpineY = vSpineY;
    if (hSpineY < vSpineY)
      finalVSpineY = Math.max(0, hSpineY - Math.floor(vSpineLen / 2));
    if (hSpineY >= vSpineY + vSpineLen)
      finalVSpineY = Math.min(
        this.height - vSpineLen,
        hSpineY - Math.floor(vSpineLen / 2),
      );

    const vSpineId = "corridor-v-spine";
    for (let y = finalVSpineY; y < finalVSpineY + vSpineLen; y++) {
      this.setGenType(vSpineX, y, "Corridor", vSpineId);
      corridors.push({ x: vSpineX, y });
      if (y > finalVSpineY) this.openWall(vSpineX, y - 1, "s");
    }
    return corridors;
  }

  private tryFillCell(x: number, y: number): boolean {
    if (this.getGenType(x, y) !== "Void") return false;
    const potentialParents = this.getNeighbors(x, y).filter(
      (n) => this.getGenType(n.x, n.y) !== "Void",
    );
    if (potentialParents.length === 0) return false;
    const parent = potentialParents[this.prng.nextInt(0, potentialParents.length - 1)];
    return this.tryPlaceRoom(x, y, parent);
  }

  private fillPass(): boolean {
    let placedAny = false;
    const indices = Array.from({ length: this.width * this.height }, (_, i) => i);
    this.prng.shuffle(indices);

    for (const idx of indices) {
      const x = idx % this.width;
      const y = Math.floor(idx / this.width);
      if (this.tryFillCell(x, y)) placedAny = true;
    }
    return placedAny;
  }

  private tryPlaceRoom(x: number, y: number, parent: Vector2): boolean {
    const shapes = [
      { w: 2, h: 2 },
      { w: 2, h: 1 },
      { w: 1, h: 2 },
      { w: 1, h: 1 },
    ];
    for (const s of shapes) {
      const offsets: Vector2[] = [];
      for (let oy = 0; oy < s.h; oy++) {
        for (let ox = 0; ox < s.w; ox++) offsets.push({ x: -ox, y: -oy });
      }
      this.prng.shuffle(offsets);
      for (const off of offsets) {
        const originX = x + off.x;
        const originY = y + off.y;
        if (this.isValidRoomShape(originX, originY, s.w, s.h)) {
          this.placeRoom({ ox: originX, oy: originY, w: s.w, h: s.h, parent });
          return true;
        }
      }
    }
    return false;
  }

  private isValidRoomShape(
    ox: number,
    oy: number,
    w: number,
    h: number,
  ): boolean {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const cx = ox + dx;
        const cy = oy + dy;
        if (cx < 0 || cx >= this.width || cy < 0 || cy >= this.height)
          return false;
        if (this.getGenType(cx, cy) !== "Void") return false;
      }
    }
    return true;
  }

  private placeRoom({
    ox,
    oy,
    w,
    h,
    parent,
  }: {
    ox: number;
    oy: number;
    w: number;
    h: number;
    parent: Vector2;
  }) {
    const roomId = `room-${ox}-${oy}`;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.setGenType(ox + dx, oy + dy, "Room", roomId);
        if (dx < w - 1) this.openWall(ox + dx, oy + dy, "e");
        if (dy < h - 1) this.openWall(ox + dx, oy + dy, "s");
      }
    }
    let connectionFound = false;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const cx = ox + dx;
        const cy = oy + dy;
        if (this.isAdjacent(parent, { x: cx, y: cy })) {
          this.placeDoor(parent.x, parent.y, cx, cy);
          connectionFound = true;
          break;
        }
      }
      if (connectionFound) break;
    }
  }

  private isAdjacent(p1: Vector2, p2: Vector2): boolean {
    return MathUtils.getManhattanDistance(p1, p2) === 1;
  }

  private finalizeCells() {
    for (let i = 0; i < this.width * this.height; i++) {
      if (this.genMap[i] === "Void") {
        this.cells[i].type = CellType.Void;
      } else {
        this.cells[i].type = CellType.Floor;
        if (this.roomIds[i]) this.cells[i].roomId = this.roomIds[i];
      }
    }
  }

  private getRoomsInCells(cells: Cell[]): Map<string, Cell[]> {
    const roomMap = new Map<string, Cell[]>();
    cells.forEach((c) => {
      if (!c.roomId || c.roomId.startsWith("corridor-")) return;
      let arr = roomMap.get(c.roomId);
      if (!arr) {
        arr = [];
        roomMap.set(c.roomId, arr);
      }
      arr.push(c);
    });
    return roomMap;
  }

  private ensureMinFloors(): Cell[] {
    const floors = this.cells.filter((c) => c.type === CellType.Floor);
    if (floors.length >= 3) return floors;

    const midX = Math.floor(this.width / 2);
    const midY = Math.floor(this.height / 2);
    const points = [
      { x: midX, y: midY },
      { x: midX, y: midY - 1 },
      { x: midX, y: midY + 1 },
      { x: midX - 1, y: midY },
      { x: midX + 1, y: midY },
    ];
    for (const p of points) {
      if (p.x < 0 || p.x >= this.width || p.y < 0 || p.y >= this.height) continue;
      this.setGenType(p.x, p.y, "Room", `room-forced-${p.x}-${p.y}`);
      if (p.x !== midX || p.y !== midY) {
        const dx = p.x - midX;
        const dy = p.y - midY;
        if (dx > 0) this.openWall(p.x, p.y, "w");
        else if (dx < 0) this.openWall(p.x, p.y, "e");
        else if (dy > 0) this.openWall(p.x, p.y, "n");
        else this.openWall(p.x, p.y, "s");
      }
    }
    this.finalizeCells();
    return this.cells.filter((c) => c.type === CellType.Floor);
  }

  private placeSquadSpawns(squadQuad: Cell[]): void {
    const roomsInSquadQuadMap = this.getRoomsInCells(squadQuad);
    const squadRoomIds = Array.from(roomsInSquadQuadMap.keys());
    this.prng.shuffle(squadRoomIds);
    const maxSquadSpawns = 2;
    this.squadSpawns = [];

    for (let i = 0; i < Math.min(maxSquadSpawns, squadRoomIds.length); i++) {
      const cells = roomsInSquadQuadMap.get(squadRoomIds[i]);
      if (!cells || cells.length === 0) continue;
      const c = cells[0];
      if (i === 0) this.squadSpawn = c;
      this.squadSpawns.push(c);
      this.placementValidator.occupy(c, OccupantType.SquadSpawn, c.roomId);
    }

    if (this.squadSpawns.length < maxSquadSpawns) {
      const available = squadQuad.filter((c) => !this.placementValidator.isCellOccupied(c));
      this.prng.shuffle(available);
      while (this.squadSpawns.length < maxSquadSpawns && available.length > 0) {
        const c = available.pop();
        if (!c) break;
        const rid = `room-forced-squad-${this.squadSpawns.length}-${c.x}-${c.y}`;
        c.roomId = rid;
        if (this.squadSpawns.length === 0) this.squadSpawn = c;
        this.squadSpawns.push(c);
        this.placementValidator.occupy(c, OccupantType.SquadSpawn, rid);
      }
    }
  }

  private findExtQuadIdx(
    squadQuadIdx: number,
    quadrants: Cell[][],
    nonEmptyQuads: { q: Cell[]; i: number }[],
  ): number {
    const oppositeMap: Record<number, number> = { 0: 3, 3: 0, 1: 2, 2: 1 };
    let extQuadIdx = oppositeMap[squadQuadIdx];
    if (quadrants[extQuadIdx].length > 0) return extQuadIdx;

    let maxDist = -1;
    nonEmptyQuads.forEach((o) => {
      const p1 = { x: o.i % 2, y: Math.floor(o.i / 2) };
      const p2 = { x: squadQuadIdx % 2, y: Math.floor(squadQuadIdx / 2) };
      const dist = MathUtils.getManhattanDistance(p1, p2);
      if (dist > maxDist) { maxDist = dist; extQuadIdx = o.i; }
    });
    return extQuadIdx;
  }

  private placeExtraction(extQuad: Cell[]): void {
    const roomsInExtQuadMap = this.getRoomsInCells(extQuad);
    const extRoomIds = Array.from(roomsInExtQuadMap.keys()).filter(
      (rid) => !this.placementValidator.isRoomOccupied(rid),
    );

    if (extRoomIds.length > 0) {
      const rid = extRoomIds[this.prng.nextInt(0, extRoomIds.length - 1)];
      const extCells = roomsInExtQuadMap.get(rid);
      if (extCells && extCells.length > 0) {
        const c = extCells[0];
        this.extraction = c;
        this.placementValidator.occupy(c, OccupantType.Extraction, rid);
      }
    } else {
      const available = extQuad.filter((c) => !this.placementValidator.isCellOccupied(c));
      const c = available.length > 0 ? available[0] : extQuad[0];
      const rid = `room-forced-ext-${c.x}-${c.y}`;
      c.roomId = rid;
      this.extraction = c;
      this.placementValidator.occupy(c, OccupantType.Extraction, rid);
    }
  }

  private placeEnemySpawns(allRoomsMap: Map<string, Cell[]>, floors: Cell[], spawnPointCount: number): void {
    const otherRoomIds = Array.from(allRoomsMap.keys()).filter(
      (rid) => !this.placementValidator.isRoomOccupied(rid),
    );
    this.prng.shuffle(otherRoomIds);
    let enemiesPlaced = 0;

    while (otherRoomIds.length > 0 && enemiesPlaced < spawnPointCount) {
      const rid = otherRoomIds.pop();
      if (!rid) break;
      const enemyCells = allRoomsMap.get(rid);
      if (!enemyCells || enemyCells.length === 0) continue;
      const c = enemyCells[0];
      this.spawnPoints.push({ id: `sp-enemy-${enemiesPlaced}`, pos: { x: c.x, y: c.y }, radius: 1 });
      this.placementValidator.occupy(c, OccupantType.EnemySpawn, rid);
      enemiesPlaced++;
    }

    if (enemiesPlaced < spawnPointCount) {
      const available = floors.filter((c) => !this.placementValidator.isCellOccupied(c));
      this.prng.shuffle(available);
      for (const c of available) {
        if (enemiesPlaced >= spawnPointCount) break;
        const rid = `room-forced-enemy-${enemiesPlaced}-${c.x}-${c.y}`;
        c.roomId = rid;
        this.spawnPoints.push({ id: `sp-enemy-${enemiesPlaced}`, pos: { x: c.x, y: c.y }, radius: 1 });
        this.placementValidator.occupy(c, OccupantType.EnemySpawn, rid);
        enemiesPlaced++;
      }
    }

    if (enemiesPlaced === 0 && spawnPointCount > 0) {
      const available = floors.find((c) => !this.placementValidator.isCellOccupied(c)) ?? floors[floors.length - 1];
      const rid = `room-forced-enemy-fallback-${available.x}-${available.y}`;
      available.roomId = rid;
      this.spawnPoints.push({ id: `sp-enemy-fallback`, pos: { x: available.x, y: available.y }, radius: 1 });
      this.placementValidator.occupy(available, OccupantType.EnemySpawn, rid, false);
    }
  }

  private placeObjectives(allRoomsMap: Map<string, Cell[]>, floors: Cell[]): void {
    const remainingRoomIds = Array.from(allRoomsMap.keys()).filter(
      (rid) => !this.placementValidator.isRoomOccupied(rid),
    );
    this.prng.shuffle(remainingRoomIds);
    let objectivesPlaced = 0;

    for (let i = 0; i < remainingRoomIds.length && objectivesPlaced < 2; i++) {
      const rid = remainingRoomIds[i];
      const objCells = allRoomsMap.get(rid);
      if (!objCells || objCells.length === 0) continue;
      const c = objCells[0];
      this.objectives.push({ id: `obj-${objectivesPlaced}`, kind: "Recover", targetCell: { x: c.x, y: c.y } });
      this.placementValidator.occupy(c, OccupantType.Objective, rid);
      objectivesPlaced++;
    }

    if (objectivesPlaced < 2) {
      const available = floors.filter((c) => !this.placementValidator.isCellOccupied(c));
      this.prng.shuffle(available);
      for (const c of available) {
        if (objectivesPlaced >= 2) break;
        const rid = `room-forced-obj-${objectivesPlaced}-${c.x}-${c.y}`;
        c.roomId = rid;
        this.objectives.push({ id: `obj-${objectivesPlaced}`, kind: "Recover", targetCell: { x: c.x, y: c.y } });
        this.placementValidator.occupy(c, OccupantType.Objective, rid);
        objectivesPlaced++;
      }
    }
  }

  private placeEntities(spawnPointCount: number) {
    const floors = this.ensureMinFloors();

    const midX = this.width / 2;
    const midY = this.height / 2;
    const quadrants: Cell[][] = [[], [], [], []];
    floors.forEach((c) => {
      const q = c.x < midX && c.y < midY ? 0 : c.x >= midX && c.y < midY ? 1 : c.x < midX ? 2 : 3;
      quadrants[q].push(c);
    });

    const nonEmptyQuads = quadrants.map((q, i) => ({ q, i })).filter((o) => o.q.length > 0);
    const squadQuadIdx = nonEmptyQuads[this.prng.nextInt(0, nonEmptyQuads.length - 1)].i;
    const squadQuad = quadrants[squadQuadIdx];

    this.placeSquadSpawns(squadQuad);

    const extQuadIdx = this.findExtQuadIdx(squadQuadIdx, quadrants, nonEmptyQuads);
    this.placeExtraction(quadrants[extQuadIdx]);

    const allRoomsMap = this.getRoomsInCells(floors);
    this.placeEnemySpawns(allRoomsMap, floors, spawnPointCount);
    this.placeObjectives(allRoomsMap, floors);
  }

  private getGenType(x: number, y: number): GenCellType {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return "Void";
    return this.genMap[y * this.width + x];
  }

  private setGenType(x: number, y: number, type: GenCellType, roomId?: string) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.genMap[y * this.width + x] = type;
    if (roomId) this.roomIds[y * this.width + x] = roomId;
  }

  private getNeighbors(x: number, y: number): Vector2[] {
    return [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ].filter(
      (n) => n.x >= 0 && n.x < this.width && n.y >= 0 && n.y < this.height,
    );
  }

  private openWall(x: number, y: number, dir: Direction) {
    let nx = x,
      ny = y;
    if (dir === "n") ny--;
    else if (dir === "e") nx++;
    else if (dir === "s") ny++;
    else if (dir === "w") nx--;
    this.walls.delete(this.getBoundaryKey(x, y, nx, ny));
  }

  private placeDoor(x1: number, y1: number, x2: number, y2: number) {
    const doorId = `door-${this.doors.length}`;
    this.openWall(x1, y1, y2 < y1 ? "n" : y2 > y1 ? "s" : x2 > x1 ? "e" : "w");
    this.doors.push({
      id: doorId,
      segment: [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      ],
      orientation: x1 === x2 ? "Horizontal" : "Vertical",
      state: "Closed",
      hp: 50,
      maxHp: 50,
      openDuration: 1,
    });
  }
}
