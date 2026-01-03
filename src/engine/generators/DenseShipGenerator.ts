import {
  MapDefinition,
  CellType,
  Cell,
  Door,
  SpawnPoint,
  ObjectiveDefinition,
  Vector2,
  WallDefinition,
} from "../../shared/types";
import { PRNG } from "../../shared/PRNG";
import { MapGenerator } from "../MapGenerator";
import { Graph } from "../Graph";
import { PlacementValidator, OccupantType } from "./PlacementValidator";

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

  public generate(spawnPointCount: number = 2): MapDefinition {
    this.placementValidator.clear();
    this.reset();

    // 1. Build Frame (Corridors)
    const corridors = this.buildFrame();

    // 2. Build Rooms (Depth 1+)
    let placed = true;
    while (placed) {
      placed = this.fillPass();
    }

    // 3. Finalize Map
    this.finalizeCells();
    this.placeEntities(corridors, spawnPointCount);

    const mapWalls: WallDefinition[] = [];
    this.walls.forEach((key) => {
      const parts = key.split("--").map((p) => p.split(",").map(Number));
      mapWalls.push({
        p1: { x: parts[0][0], y: parts[0][1] },
        p2: { x: parts[1][0], y: parts[1][1] },
      });
    });

    const map: MapDefinition = {
      width: this.width,
      height: this.height,
      cells: this.cells,
      walls: mapWalls,
      doors: this.doors,
      spawnPoints: this.spawnPoints,
      squadSpawn: this.squadSpawn,
      squadSpawns: this.squadSpawns,
      extraction: this.extraction,
      objectives: this.objectives,
    };

    MapGenerator.sanitize(map);
    return map;
  }

  // --- Debug / Golden Output ---
  public toDetailedDebugString(): string {
    const map = this.generate();
    const graph = new Graph(map);
    const expandedWidth = this.width * 2 + 1;
    const expandedHeight = this.height * 2 + 1;
    const grid: string[][] = Array.from({ length: expandedHeight }, () =>
      Array(expandedWidth).fill(" "),
    );

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const type = this.getGenType(x, y);
        const ex = x * 2 + 1;
        const ey = y * 2 + 1;
        grid[ey][ex] = type === "Corridor" ? "C" : type === "Room" ? "R" : "#";

        const cell = graph.cells[y][x];
        const n = cell.edges.n;
        if (n?.isWall) grid[ey - 1][ex] = n.doorId ? "=" : "-";
        const s = cell.edges.s;
        if (s?.isWall) grid[ey + 1][ex] = s.doorId ? "=" : "-";
        const e = cell.edges.e;
        if (e?.isWall) grid[ey][ex + 1] = e.doorId ? "I" : "|";
        const w = cell.edges.w;
        if (w?.isWall) grid[ey][ex - 1] = w.doorId ? "I" : "|";
      }
    }

    for (let y = 0; y < expandedHeight; y += 2) {
      for (let x = 0; x < expandedWidth; x += 2) {
        if (grid[y][x] === " ") {
          let wallCount = 0;
          if (y > 0 && ["|", "I", "#"].includes(grid[y - 1][x])) wallCount++;
          if (
            y < expandedHeight - 1 &&
            ["|", "I", "#"].includes(grid[y + 1][x])
          )
            wallCount++;
          if (x > 0 && ["-", "=", "#"].includes(grid[y][x - 1])) wallCount++;
          if (x < expandedWidth - 1 && ["-", "=", "#"].includes(grid[y][x + 1]))
            wallCount++;
          if (wallCount >= 2) grid[y][x] = "+";
        }
      }
    }

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
      out += line + "\n";
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
          type: CellType.Wall,
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

  private fillPass(): boolean {
    let placedAny = false;
    const indices = Array.from(
      { length: this.width * this.height },
      (_, i) => i,
    );
    this.prng.shuffle(indices);

    for (const idx of indices) {
      const x = idx % this.width;
      const y = Math.floor(idx / this.width);
      if (this.getGenType(x, y) !== "Void") continue;
      const potentialParents = this.getNeighbors(x, y).filter(
        (n) => this.getGenType(n.x, n.y) !== "Void",
      );
      if (potentialParents.length > 0) {
        const parent =
          potentialParents[this.prng.nextInt(0, potentialParents.length - 1)];
        if (this.tryPlaceRoom(x, y, parent)) placedAny = true;
      }
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
          this.placeRoom(originX, originY, s.w, s.h, parent);
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

  private placeRoom(
    ox: number,
    oy: number,
    w: number,
    h: number,
    parent: Vector2,
  ) {
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
    return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y) === 1;
  }

  private finalizeCells() {
    for (let i = 0; i < this.width * this.height; i++) {
      if (this.genMap[i] === "Void") {
        this.cells[i].type = CellType.Wall;
      } else {
        this.cells[i].type = CellType.Floor;
        if (this.roomIds[i]) this.cells[i].roomId = this.roomIds[i];
      }
    }
  }

  private placeEntities(corridors: Vector2[], spawnPointCount: number) {
    const floors = this.cells.filter((c) => c.type === CellType.Floor);
    if (floors.length === 0) return;

    // 1. Divide floor cells into quadrants
    const midX = this.width / 2;
    const midY = this.height / 2;

    const quadrants: Cell[][] = [[], [], [], []];
    floors.forEach((c) => {
      if (c.x < midX && c.y < midY) quadrants[0].push(c);
      else if (c.x >= midX && c.y < midY) quadrants[1].push(c);
      else if (c.x < midX && c.y >= midY) quadrants[2].push(c);
      else quadrants[3].push(c);
    });

    // 2. Pick Squad Spawn quadrant
    const nonEmptyQuads = quadrants
      .map((q, i) => ({ q, i }))
      .filter((obj) => obj.q.length > 0);
    if (nonEmptyQuads.length === 0) return;

    const squadQuadIdx =
      nonEmptyQuads[this.prng.nextInt(0, nonEmptyQuads.length - 1)].i;
    const squadQuad = quadrants[squadQuadIdx];

    // Pick TWO distinct entrance points in the same quadrant but different rooms
    const roomsInQuad = new Map<string, Cell[]>();
    squadQuad.forEach((c) => {
      if (c.roomId) {
        if (!roomsInQuad.has(c.roomId)) roomsInQuad.set(c.roomId, []);
        roomsInQuad.get(c.roomId)!.push(c);
      }
    });

    const roomIds = Array.from(roomsInQuad.keys()).filter((id) =>
      id.startsWith("room-"),
    );

    if (roomIds.length >= 2) {
      this.prng.shuffle(roomIds);
      const r1 = roomIds[0];
      const r2 = roomIds[1];
      const r1Cells = roomsInQuad.get(r1)!;
      const r2Cells = roomsInQuad.get(r2)!;
      const c1 = r1Cells[this.prng.nextInt(0, r1Cells.length - 1)];
      const c2 = r2Cells[this.prng.nextInt(0, r2Cells.length - 1)];
      this.squadSpawns = [
        { x: c1.x, y: c1.y },
        { x: c2.x, y: c2.y },
      ];
      this.squadSpawn = this.squadSpawns[0];
    } else {
      const roomCellsInQuad = squadQuad.filter(
        (c) => c.roomId && c.roomId.startsWith("room-"),
      );
      if (roomCellsInQuad.length > 0) {
        const squadCell =
          roomCellsInQuad[this.prng.nextInt(0, roomCellsInQuad.length - 1)];
        this.squadSpawn = { x: squadCell.x, y: squadCell.y };
        this.squadSpawns = [this.squadSpawn];
      } else {
        // Absolute fallback to any room in the map
        const allRoomCells = floors.filter(
          (c) => c.roomId && c.roomId.startsWith("room-"),
        );
        if (allRoomCells.length > 0) {
          const squadCell =
            allRoomCells[this.prng.nextInt(0, allRoomCells.length - 1)];
          this.squadSpawn = { x: squadCell.x, y: squadCell.y };
          this.squadSpawns = [this.squadSpawn];
        } else {
          const squadCell =
            floors[this.prng.nextInt(0, floors.length - 1)];
          this.squadSpawn = { x: squadCell.x, y: squadCell.y };
          this.squadSpawns = [this.squadSpawn];
        }
      }
    }

    if (this.squadSpawns) {
      this.squadSpawns.forEach((ss) =>
        this.placementValidator.occupy(ss, OccupantType.SquadSpawn),
      );
    }

    // 3. Pick Extraction quadrant (opposite if possible)
    const oppositeMap: Record<number, number> = { 0: 3, 3: 0, 1: 2, 2: 1 };
    let extQuadIdx = oppositeMap[squadQuadIdx];

    if (quadrants[extQuadIdx].length === 0) {
      let maxDist = -1;
      nonEmptyQuads.forEach((obj) => {
        const dist =
          Math.abs((obj.i % 2) - (squadQuadIdx % 2)) +
          Math.abs(Math.floor(obj.i / 2) - Math.floor(squadQuadIdx / 2));
        if (dist > maxDist) {
          maxDist = dist;
          extQuadIdx = obj.i;
        }
      });
    }

    const extQuad = quadrants[extQuadIdx];
    const availableExtCells = extQuad.filter(
      (c) => !this.placementValidator.isCellOccupied(c),
    );
    if (availableExtCells.length > 0) {
      const extCell =
        availableExtCells[this.prng.nextInt(0, availableExtCells.length - 1)];
      this.extraction = { x: extCell.x, y: extCell.y };
      this.placementValidator.occupy(this.extraction, OccupantType.Extraction);
    }

    // 4. Enemy spawns and objectives (using rooms)
    const roomMap = new Map<string, Vector2[]>();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const rid = this.roomIds[y * this.width + x];
        if (rid && rid.startsWith("room-")) {
          if (!roomMap.has(rid)) roomMap.set(rid, []);
          roomMap.get(rid)!.push({ x, y });
        }
      }
    }
    const rooms = Array.from(roomMap.values());
    if (rooms.length === 0) {
      return;
    }

    this.prng.shuffle(rooms);
    // Exclude rooms containing ANY squadSpawn
    const squadRoomIds = new Set<string>();
    if (this.squadSpawns) {
      this.squadSpawns.forEach((ss) => {
        const cellIdx = ss.y * this.width + ss.x;
        const rid = this.roomIds[cellIdx];
        if (rid) squadRoomIds.add(rid);
      });
    }

    const otherRooms = rooms.filter((r) => {
      const rid = this.roomIds[r[0].y * this.width + r[0].x];
      const isSquadRoom = squadRoomIds.has(rid);
      return !isSquadRoom;
    });

    let enemySpawnsPlaced = 0;
    for (
      let i = 0;
      i < otherRooms.length && enemySpawnsPlaced < spawnPointCount;
      i++
    ) {
      const r = otherRooms[i];
      const candidate = r[Math.floor(r.length / 2)];
      if (this.placementValidator.occupy(candidate, OccupantType.EnemySpawn)) {
        this.spawnPoints.push({
          id: `sp-enemy-${enemySpawnsPlaced}`,
          pos: { x: candidate.x, y: candidate.y },
          radius: 1,
        });
        enemySpawnsPlaced++;
      } else {
        const available = r.find(
          (c) => !this.placementValidator.isCellOccupied(c),
        );
        if (
          available &&
          this.placementValidator.occupy(available, OccupantType.EnemySpawn)
        ) {
          this.spawnPoints.push({
            id: `sp-enemy-${enemySpawnsPlaced}`,
            pos: { x: available.x, y: available.y },
            radius: 1,
          });
          enemySpawnsPlaced++;
        }
      }
    }

    const objRooms = otherRooms.slice(enemySpawnsPlaced);
    let objectivesPlaced = 0;
    for (let i = 0; i < objRooms.length && objectivesPlaced < 2; i++) {
      const r = objRooms[i];
      const candidate = r[Math.floor(r.length / 2)];
      if (this.placementValidator.occupy(candidate, OccupantType.Objective)) {
        this.objectives.push({
          id: `obj-${objectivesPlaced}`,
          kind: "Recover",
          targetCell: { x: candidate.x, y: candidate.y },
        });
        objectivesPlaced++;
      } else {
        const available = r.find(
          (c) => !this.placementValidator.isCellOccupied(c),
        );
        if (
          available &&
          this.placementValidator.occupy(available, OccupantType.Objective)
        ) {
          this.objectives.push({
            id: `obj-${objectivesPlaced}`,
            kind: "Recover",
            targetCell: { x: available.x, y: available.y },
          });
          objectivesPlaced++;
        }
      }
    }
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

  private openWall(x: number, y: number, dir: "n" | "e" | "s" | "w") {
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
