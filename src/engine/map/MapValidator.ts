import type {
  MapDefinition,
  IMapValidationResult,
  Vector2} from "../../shared/types";
import {
  CellType,
  BoundaryType,
} from "../../shared/types";
import type { Direction } from "../Graph";
import { Graph } from "../Graph";

type GraphType = InstanceType<typeof Graph>;

function isWithinBounds(width: number, height: number, x: number, y: number): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}

function validateCells(map: MapDefinition, graph: GraphType, issues: string[]): Set<string> {
  const { width, height, cells } = map;
  const cellLookup = new Set<string>();
  for (const cell of cells) {
    const key = `${cell.x},${cell.y}`;
    if (cellLookup.has(key)) {
      issues.push(`Duplicate cell definition at (${cell.x}, ${cell.y}).`);
    }
    cellLookup.add(key);
    if (!isWithinBounds(width, height, cell.x, cell.y)) {
      issues.push(`Cell at (${cell.x}, ${cell.y}) is out of map bounds.`);
    }
  }
  // Validate open boundaries
  for (const b of graph.getAllBoundaries()) {
    if (b.type !== BoundaryType.Open) continue;
    const c1 = graph.cells[b.y1]?.[b.x1];
    const c2 = graph.cells[b.y2]?.[b.x2];
    if (!c1 || !c2 || c1.type !== CellType.Floor || c2.type !== CellType.Floor) {
      issues.push(`Open boundary at (${b.x1},${b.y1})--(${b.x2},${b.y2}) must be between two Floor cells.`);
    }
  }
  return cellLookup;
}

function validateDoors(map: MapDefinition, graph: GraphType, issues: string[]): void {
  const { width, height, doors } = map;
  if (!doors) return;
  for (const door of doors) {
    if (!door.id) { issues.push("Door found with no ID."); continue; }
    if (door.segment?.length !== 2) { issues.push(`Door ${door.id} must have exactly 2 segments.`); continue; }
    for (const segmentPart of door.segment) {
      if (!isWithinBounds(width, height, segmentPart.x, segmentPart.y)) {
        issues.push(`Door ${door.id} segment at (${segmentPart.x}, ${segmentPart.y}) is out of map bounds.`);
      } else {
        const cell = graph.cells[segmentPart.y][segmentPart.x];
        if (cell.type !== CellType.Floor) {
          issues.push(`Door ${door.id} segment at (${segmentPart.x}, ${segmentPart.y}) is not a Floor cell.`);
        }
      }
    }
  }
}

type ValidateCtx = { width: number; height: number; graph: GraphType; issues: string[] };

function validatePoint(pos: Vector2, label: string, ctx: ValidateCtx, requireRoom = false): void {
  const { width, height, graph, issues } = ctx;
  if (!isWithinBounds(width, height, pos.x, pos.y)) {
    issues.push(`${label} at (${pos.x}, ${pos.y}) is out of map bounds.`);
    return;
  }
  const cell = graph.cells[pos.y][pos.x];
  if (cell.type !== CellType.Floor) {
    issues.push(`${label} at (${pos.x}, ${pos.y}) is not on a Floor cell.`);
  }
  if (requireRoom && (!cell.roomId || cell.roomId.startsWith("corridor-"))) {
    issues.push(`${label} at (${pos.x}, ${pos.y}) must be in a room, not a corridor.`);
  }
}

function validateSpawnPoints(map: MapDefinition, graph: GraphType, issues: string[]): Set<string> {
  const { width, height, spawnPoints } = map;
  const enemySpawnRooms = new Set<string>();
  if (!spawnPoints || spawnPoints.length === 0) {
    issues.push("No spawn points defined.");
    return enemySpawnRooms;
  }
  const ctx: ValidateCtx = { width, height, graph, issues };
  for (const sp of spawnPoints) {
    validatePoint(sp.pos, `Spawn point ${sp.id}`, ctx, true);
    if (isWithinBounds(width, height, sp.pos.x, sp.pos.y)) {
      const cell = graph.cells[sp.pos.y][sp.pos.x];
      if (cell.roomId) enemySpawnRooms.add(cell.roomId);
    }
  }
  return enemySpawnRooms;
}

function validateExtraction(map: MapDefinition, graph: GraphType, issues: string[]): string | undefined {
  const { width, height, extraction } = map;
  if (!extraction) return undefined;
  validatePoint(extraction, "Extraction point", { width, height, graph, issues }, true);
  if (isWithinBounds(width, height, extraction.x, extraction.y)) {
    return graph.cells[extraction.y][extraction.x].roomId;
  }
  return undefined;
}

function validateObjectives(map: MapDefinition, graph: GraphType, issues: string[]): Set<string> {
  const { width, height } = map;
  const objectiveRoomIds = new Set<string>();
  if (!map.objectives) return objectiveRoomIds;
  const ctx: ValidateCtx = { width, height, graph, issues };
  for (const obj of map.objectives) {
    if (!obj.targetCell) continue;
    validatePoint(obj.targetCell, `Objective ${obj.id}`, ctx, true);
    if (isWithinBounds(width, height, obj.targetCell.x, obj.targetCell.y)) {
      const cell = graph.cells[obj.targetCell.y][obj.targetCell.x];
      if (cell.roomId) objectiveRoomIds.add(cell.roomId);
    }
  }
  return objectiveRoomIds;
}

function validateBonusLoot(map: MapDefinition, graph: GraphType, issues: string[]): void {
  const { width, height } = map;
  if (!map.bonusLoot) return;
  const ctx: ValidateCtx = { width, height, graph, issues };
  for (const loot of map.bonusLoot) {
    validatePoint(loot, "Loot", ctx, true);
  }
}

function validateSquadSpawn(map: MapDefinition, graph: GraphType, issues: string[]): Set<string> {
  const { width, height } = map;
  const squadSpawnRooms = new Set<string>();
  const ctx: ValidateCtx = { width, height, graph, issues };
  if (map.squadSpawn) {
    validatePoint(map.squadSpawn, "Squad spawn point", ctx, true);
    if (isWithinBounds(width, height, map.squadSpawn.x, map.squadSpawn.y)) {
      const cell = graph.cells[map.squadSpawn.y][map.squadSpawn.x];
      if (cell.roomId) squadSpawnRooms.add(cell.roomId);
    }
  }
  if (map.squadSpawns) {
    for (const ss of map.squadSpawns) {
      validatePoint(ss, "Squad spawn point", ctx, true);
      if (isWithinBounds(width, height, ss.x, ss.y)) {
        const cell = graph.cells[ss.y][ss.x];
        if (cell.roomId) squadSpawnRooms.add(cell.roomId);
      }
    }
  }
  return squadSpawnRooms;
}

function validateRoomExclusivity(params: {
  squadSpawnRooms: Set<string>;
  enemySpawnRooms: Set<string>;
  extractionRoomId: string | undefined;
  objectiveRoomIds: Set<string>;
  isSmallMap: boolean;
  issues: string[];
}): void {
  const { squadSpawnRooms, enemySpawnRooms, extractionRoomId, objectiveRoomIds, isSmallMap, issues } = params;
  for (const roomId of squadSpawnRooms) {
    if (enemySpawnRooms.has(roomId)) issues.push(`Squad and Enemy spawn points share the same room: ${roomId}`);
    if (extractionRoomId === roomId) issues.push(`Squad spawn and Extraction share the same room: ${roomId}`);
    if (objectiveRoomIds.has(roomId)) issues.push(`Squad spawn and Objective share the same room: ${roomId}`);
  }
  for (const roomId of enemySpawnRooms) {
    if (extractionRoomId === roomId) issues.push(`Enemy spawn and Extraction share the same room: ${roomId}`);
  }
  if (!isSmallMap) {
    for (const roomId of objectiveRoomIds) {
      if (enemySpawnRooms.has(roomId)) issues.push(`Objective and Enemy spawn share the same room on large map: ${roomId}`);
      if (extractionRoomId === roomId) issues.push(`Objective and Extraction share the same room on large map: ${roomId}`);
    }
  }
}

function validateCellExclusivity(map: MapDefinition, issues: string[]): void {
  const { spawnPoints, extraction, objectives } = map;
  const occupiedCells = new Map<string, string>();
  const checkExclusivity = (pos: Vector2, type: string) => {
    const key = `${pos.x},${pos.y}`;
    if (occupiedCells.has(key)) {
      issues.push(`${type} at (${pos.x}, ${pos.y}) overlaps with ${occupiedCells.get(key)}.`);
    } else {
      occupiedCells.set(key, type);
    }
  };

  if (map.squadSpawn) checkExclusivity(map.squadSpawn, "Squad spawn");
  if (map.squadSpawns) {
    for (const ss of map.squadSpawns) {
      if (ss.x === map.squadSpawn?.x && ss.y === map.squadSpawn.y) continue;
      checkExclusivity(ss, "Squad spawn");
    }
  }
  if (spawnPoints) {
    for (const sp of spawnPoints) checkExclusivity(sp.pos, `Enemy spawn ${sp.id}`);
  }
  if (extraction) checkExclusivity(extraction, "Extraction point");
  if (objectives) {
    for (const obj of objectives) {
      if (obj.targetCell) checkExclusivity(obj.targetCell, `Objective ${obj.id}`);
    }
  }
  if (map.bonusLoot) {
    for (const loot of map.bonusLoot) checkExclusivity(loot, "Loot container");
  }
}

function isBoundaryTraversable(boundary: { type: BoundaryType; doorId?: string } | null, doors: MapDefinition["doors"]): boolean {
  if (!boundary) return false;
  if (boundary.type === BoundaryType.Open) return true;
  if (!boundary.doorId || !doors) return false;
  const door = doors.find((dr) => dr.id === boundary.doorId);
  return door !== undefined && door.state !== "Locked";
}

function traverseFromPoints(startPoints: Vector2[], graph: GraphType, map: MapDefinition): Set<string> {
  const { width, height } = map;
  const visited = new Set<string>();
  const queue: Vector2[] = [...startPoints];
  for (const sp of startPoints) visited.add(`${sp.x},${sp.y}`);

  const dirs: Direction[] = ["n", "e", "s", "w"];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const cell = graph.cells[current.y]?.[current.x];
    if (!cell) continue;
    for (const d of dirs) {
      if (!isBoundaryTraversable(cell.edges[d], map.doors)) continue;
      const nx = d === "e" ? current.x + 1 : d === "w" ? current.x - 1 : current.x;
      const ny = d === "s" ? current.y + 1 : d === "n" ? current.y - 1 : current.y;
      if (!isWithinBounds(width, height, nx, ny) || visited.has(`${nx},${ny}`)) continue;
      const nCell = graph.cells[ny]?.[nx];
      if (nCell?.type === CellType.Floor) {
        visited.add(`${nx},${ny}`);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return visited;
}

function validateEnemyReachability(map: MapDefinition, graph: GraphType, issues: string[]): void {
  const { spawnPoints, cells } = map;
  if (!spawnPoints || spawnPoints.length === 0) return;
  const visited = traverseFromPoints(spawnPoints.map((sp) => sp.pos), graph, map);
  for (const cellDef of cells) {
    if (cellDef.type === CellType.Floor && !visited.has(`${cellDef.x},${cellDef.y}`)) {
      issues.push(`Floor cell at (${cellDef.x}, ${cellDef.y}) is not reachable from any spawn point.`);
    }
  }
}

function validateSquadReachability(map: MapDefinition, graph: GraphType, issues: string[]): void {
  const squadStart = map.squadSpawn ?? map.squadSpawns?.[0];
  if (!squadStart) return;
  const { extraction, objectives } = map;
  const visited = traverseFromPoints([squadStart], graph, map);
  if (extraction && !visited.has(`${extraction.x},${extraction.y}`)) {
    issues.push(`Extraction point at (${extraction.x}, ${extraction.y}) is not reachable from squad spawn.`);
  }
  if (objectives) {
    for (const obj of objectives) {
      if (obj.targetCell && !visited.has(`${obj.targetCell.x},${obj.targetCell.y}`)) {
        issues.push(`Objective ${obj.id} at (${obj.targetCell.x}, ${obj.targetCell.y}) is not reachable from squad spawn.`);
      }
    }
  }
}

export class MapValidator {
  public static validate(map: MapDefinition): IMapValidationResult {
    const issues: string[] = [];
    const { width, height } = map;
    const graph = new Graph(map);

    if (width <= 0 || height <= 0) {
      issues.push("Map dimensions (width and height) must be positive.");
    }

    validateCells(map, graph, issues);
    validateDoors(map, graph, issues);

    const enemySpawnRooms = validateSpawnPoints(map, graph, issues);
    const extractionRoomId = validateExtraction(map, graph, issues);
    const objectiveRoomIds = validateObjectives(map, graph, issues);
    validateBonusLoot(map, graph, issues);
    const squadSpawnRooms = validateSquadSpawn(map, graph, issues);

    validateRoomExclusivity({
      squadSpawnRooms,
      enemySpawnRooms,
      extractionRoomId,
      objectiveRoomIds,
      isSmallMap: width * height <= 25,
      issues,
    });

    validateCellExclusivity(map, issues);
    validateEnemyReachability(map, graph, issues);
    validateSquadReachability(map, graph, issues);

    return { isValid: issues.length === 0, issues };
  }
}
