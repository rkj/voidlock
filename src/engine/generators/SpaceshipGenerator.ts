import {
  MapDefinition,
  CellType,
  Cell,
  Door,
  SpawnPoint,
  Objective,
  Vector2,
  WallDefinition,
} from "../../shared/types";
import { PRNG } from "../../shared/PRNG";
import { MapGenerator } from "../MapGenerator";
import { PlacementValidator, OccupantType } from "./PlacementValidator";

export class SpaceshipGenerator {
  private prng: PRNG;
  private width: number;
  private height: number;
  private cells: Cell[] = [];
  private walls: Set<string> = new Set();
  private doors: Door[] = [];
  private spawnPoints: SpawnPoint[] = [];
  private squadSpawn?: { x: number; y: number };
  private squadSpawns?: { x: number; y: number }[];
  private objectives: Objective[] = [];
  private extraction?: { x: number; y: number };
  private placementValidator: PlacementValidator = new PlacementValidator();

  constructor(seed: number, width: number, height: number) {
    this.prng = new PRNG(seed);
    this.width = width;
    this.height = height;
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

  public generate(spawnPointCount: number = 1): MapDefinition {
    this.placementValidator.clear();
    // 1. Initialize Grid (Void) and all boundaries as walls
    this.cells = Array(this.height * this.width)
      .fill(null)
      .map((_, i) => ({
        x: i % this.width,
        y: Math.floor(i / this.width),
        type: CellType.Wall,
      }));

    this.walls.clear();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        // Horizontal wall (separates from neighbor to the right)
        this.walls.add(this.getBoundaryKey(x, y, x + 1, y));
        // Vertical wall (separates from neighbor below)
        this.walls.add(this.getBoundaryKey(x, y, x, y + 1));
        // Borders (negative coords)
        if (x === 0) this.walls.add(this.getBoundaryKey(-1, y, 0, y));
        if (y === 0) this.walls.add(this.getBoundaryKey(x, -1, x, 0));
      }
    }

    // 2. Place Dense Rooms
    const targetRoomArea = this.width * this.height * 0.4;
    let currentRoomArea = 0;
    let attempts = 0;
    const maxAttempts = 2000;
    const rooms: { x: number; y: number; w: number; h: number }[] = [];

    while (currentRoomArea < targetRoomArea && attempts < maxAttempts) {
      attempts++;
      const w = this.prng.nextInt(1, 2);
      const h = this.prng.nextInt(1, 2);
      const x = this.prng.nextInt(1, this.width - w - 1);
      const y = this.prng.nextInt(1, this.height - h - 1);

      let collision = false;
      for (let dy = -1; dy <= h; dy++) {
        for (let dx = -1; dx <= w; dx++) {
          const cell = this.getCell(x + dx, y + dy);
          if (cell && cell.type === CellType.Floor) {
            collision = true;
            break;
          }
        }
        if (collision) break;
      }

      if (!collision) {
        const roomId = `room-${x}-${y}`;
        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            this.setFloor(x + dx, y + dy);
            const cell = this.getCell(x + dx, y + dy);
            if (cell) cell.roomId = roomId;
            if (dx < w - 1) this.openWall(x + dx, y + dy, "e");
            if (dy < h - 1) this.openWall(x + dx, y + dy, "s");
          }
        }
        rooms.push({ x, y, w, h });
        currentRoomArea += w * h;
      }
    }

    // 3. Maze Generation
    const stack: { x: number; y: number }[] = [];
    let startX = 1;
    let startY = 1;
    for (let i = 0; i < 100; i++) {
      const tx = this.prng.nextInt(1, this.width - 2);
      const ty = this.prng.nextInt(1, this.height - 2);
      if (this.getCell(tx, ty)?.type === CellType.Wall) {
        startX = tx;
        startY = ty;
        break;
      }
    }

    if (this.getCell(startX, startY)?.type === CellType.Wall) {
      this.setFloor(startX, startY);
      const cell = this.getCell(startX, startY);
      if (cell) cell.roomId = "corridor-maze";
      stack.push({ x: startX, y: startY });
    }

    const dirs = [
      { dx: 0, dy: -1, k: "n" },
      { dx: 0, dy: 1, k: "s" },
      { dx: 1, dy: 0, k: "e" },
      { dx: -1, dy: 0, k: "w" },
    ];
    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbors: any[] = [];
      const shuffledDirs = [...dirs].sort(() => this.prng.next() - 0.5);

      for (const dir of shuffledDirs) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;
        const neighbor = this.getCell(nx, ny);
        if (neighbor && neighbor.type === CellType.Wall) {
          neighbors.push({ x: nx, y: ny, dir: dir.k });
        }
      }

      if (neighbors.length > 0) {
        const next = neighbors[0];
        this.setFloor(next.x, next.y);
        const cell = this.getCell(next.x, next.y);
        if (cell) cell.roomId = "corridor-maze";
        this.openWall(current.x, current.y, next.dir as any);
        stack.push({ x: next.x, y: next.y });
      } else {
        stack.pop();
      }
    }

    // 4. Connect Disconnected Regions
    rooms.forEach((room) => {
      const connections: { x: number; y: number; dir: string }[] = [];
      for (let dy = 0; dy < room.h; dy++) {
        if (this.getCell(room.x - 1, room.y + dy)?.type === CellType.Floor)
          connections.push({ x: room.x, y: room.y + dy, dir: "w" });
        if (this.getCell(room.x + room.w, room.y + dy)?.type === CellType.Floor)
          connections.push({
            x: room.x + room.w - 1,
            y: room.y + dy,
            dir: "e",
          });
      }
      for (let dx = 0; dx < room.w; dx++) {
        if (this.getCell(room.x + dx, room.y - 1)?.type === CellType.Floor)
          connections.push({ x: room.x + dx, y: room.y, dir: "n" });
        if (this.getCell(room.x + dx, room.y + room.h)?.type === CellType.Floor)
          connections.push({
            x: room.x + dx,
            y: room.y + room.h - 1,
            dir: "s",
          });
      }

      if (connections.length > 0) {
        const conn = connections[this.prng.nextInt(0, connections.length - 1)];
        this.placeDoor(conn.x, conn.y, conn.dir);
        if (connections.length > 1 && this.prng.next() < 0.4) {
          let conn2 = connections[this.prng.nextInt(0, connections.length - 1)];
          while (conn2 === conn)
            conn2 = connections[this.prng.nextInt(0, connections.length - 1)];
          this.placeDoor(conn2.x, conn2.y, conn2.dir);
        }
      }
    });

    // 5. Ensure Full Connectivity
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        if (this.getCell(x, y)?.type === CellType.Wall) {
          const floorNeighbors = dirs
            .map((d) => ({ x: x + d.dx, y: y + d.dy, d: d.k }))
            .filter((n) => this.getCell(n.x, n.y)?.type === CellType.Floor);
          if (floorNeighbors.length > 0) {
            const n =
              floorNeighbors[this.prng.nextInt(0, floorNeighbors.length - 1)];
            this.setFloor(x, y);
            const cell = this.getCell(x, y);
            if (cell) cell.roomId = "corridor-patch";
            this.openWall(x, y, n.d as any);
          }
        }
      }
    }

    // 6. Place Features
    this.placeFeatures(spawnPointCount);

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

  private setFloor(x: number, y: number) {
    const cell = this.getCell(x, y);
    if (cell) cell.type = CellType.Floor;
  }

  private getCell(x: number, y: number): Cell | undefined {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return undefined;
    return this.cells[y * this.width + x];
  }

  private openWall(x: number, y: number, dir: "n" | "e" | "s" | "w") {
    let x2 = x,
      y2 = y;
    if (dir === "n") y2--;
    else if (dir === "e") x2++;
    else if (dir === "s") y2++;
    else if (dir === "w") x2--;
    this.walls.delete(this.getBoundaryKey(x, y, x2, y2));
  }

  private placeDoor(x: number, y: number, dir: string) {
    const doorId = `door-${this.doors.length}`;
    let segment: Vector2[];
    let orientation: "Horizontal" | "Vertical";
    if (dir === "n") {
      orientation = "Horizontal";
      segment = [
        { x, y: y - 1 },
        { x, y },
      ];
    } else if (dir === "s") {
      orientation = "Horizontal";
      segment = [
        { x, y },
        { x, y: y + 1 },
      ];
    } else if (dir === "w") {
      orientation = "Vertical";
      segment = [
        { x: x - 1, y },
        { x, y },
      ];
    } else {
      orientation = "Vertical";
      segment = [
        { x, y },
        { x: x + 1, y },
      ];
    }

    this.openWall(x, y, dir as any); // Door opens the wall in map.walls
    this.doors.push({
      id: doorId,
      state: "Closed",
      orientation,
      segment,
      hp: 50,
      maxHp: 50,
      openDuration: 1,
    });
  }

  private placeFeatures(spawnPointCount: number) {
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

    // 2. Pick Squad Spawn quadrant (preferring non-empty)
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
    ); // Prefer rooms over corridors if possible

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

    // 3. Pick Extraction quadrant (opposite if possible, else furthest non-empty)
    const oppositeMap: Record<number, number> = { 0: 3, 3: 0, 1: 2, 2: 1 };
    let extQuadIdx = oppositeMap[squadQuadIdx];

    if (quadrants[extQuadIdx].length === 0) {
      // Find furthest non-empty quadrant
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
    const extIdx = this.prng.nextInt(0, extQuad.length - 1);
    const extCell = extQuad[extIdx];
    this.extraction = { x: extCell.x, y: extCell.y };
    this.placementValidator.occupy(this.extraction, OccupantType.Extraction);

    // 4. Place Enemy Spawn Points
    const squadRoomIds = new Set<string>();
    if (this.squadSpawns) {
      this.squadSpawns.forEach((ss) => {
        const cell = this.getCell(ss.x, ss.y);
        if (cell?.roomId) squadRoomIds.add(cell.roomId);
      });
    }

    const roomMap = new Map<string, Cell[]>();
    floors.forEach((c) => {
      if (c.roomId && c.roomId.startsWith("room-")) {
        if (!roomMap.has(c.roomId)) roomMap.set(c.roomId, []);
        roomMap.get(c.roomId)!.push(c);
      }
    });

    const otherRooms = Array.from(roomMap.entries())
      .filter(([rid, _cells]) => !squadRoomIds.has(rid))
      .map(([_rid, cells]) => cells);

    this.prng.shuffle(otherRooms);

    let enemySpawnsPlaced = 0;
    for (
      let i = 0;
      i < otherRooms.length && enemySpawnsPlaced < spawnPointCount;
      i++
    ) {
      const r = otherRooms[i];
      const spIdx = this.prng.nextInt(0, r.length - 1);
      const sp = r[spIdx];
      if (this.placementValidator.occupy(sp, OccupantType.EnemySpawn)) {
        this.spawnPoints.push({
          id: `spawn-${enemySpawnsPlaced + 1}`,
          pos: { x: sp.x, y: sp.y },
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
            id: `spawn-${enemySpawnsPlaced + 1}`,
            pos: { x: available.x, y: available.y },
            radius: 1,
          });
          enemySpawnsPlaced++;
        }
      }
    }

    // 5. Place Objectives (far from squadSpawn, not in squad room)
    const referencePos = this.squadSpawn!;
    const objectiveCandidates = floors.filter((c) => {
      if (!c.roomId || !c.roomId.startsWith("room-")) return false;
      if (squadRoomIds.has(c.roomId)) return false;
      return (
        Math.abs(c.x - referencePos.x) + Math.abs(c.y - referencePos.y) > 5
      );
    });

    if (objectiveCandidates.length > 0) {
      const objIdx = this.prng.nextInt(0, objectiveCandidates.length - 1);
      const objCell = objectiveCandidates[objIdx];
      if (this.placementValidator.occupy(objCell, OccupantType.Objective)) {
        this.objectives.push({
          id: "obj-1",
          kind: "Recover",
          targetCell: { x: objCell.x, y: objCell.y },
          state: "Pending",
        });
      } else {
        const available = objectiveCandidates.find(
          (c) => !this.placementValidator.isCellOccupied(c),
        );
        if (
          available &&
          this.placementValidator.occupy(available, OccupantType.Objective)
        ) {
          this.objectives.push({
            id: "obj-1",
            kind: "Recover",
            targetCell: { x: available.x, y: available.y },
            state: "Pending",
          });
        }
      }
    }
  }
}
