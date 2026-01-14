import {
  MapDefinition,
  CellType,
  IMapValidationResult,
  Vector2,
  BoundaryType,
} from "../../shared/types";
import { Graph, Direction } from "../Graph";

export class MapValidator {
  public static validate(map: MapDefinition): IMapValidationResult {
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
      if (b.type === BoundaryType.Open) {
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

    if (map.bonusLoot) {
      for (const loot of map.bonusLoot) {
        if (!isWithinBounds(loot.x, loot.y)) {
          issues.push(`Loot at (${loot.x}, ${loot.y}) is out of map bounds.`);
        } else {
          const cell = graph.cells[loot.y][loot.x];
          if (cell.type !== CellType.Floor) {
            issues.push(
              `Loot at (${loot.x}, ${loot.y}) is not on a Floor cell.`,
            );
          }
          if (!cell.roomId || cell.roomId.startsWith("corridor-")) {
            issues.push(
              `Loot at (${loot.x}, ${loot.y}) must be in a room, not a corridor.`,
            );
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
    if (map.bonusLoot) {
      for (const loot of map.bonusLoot) {
        checkExclusivity(loot, "Loot container");
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
            let canTraverse = boundary.type === BoundaryType.Open;
            if (boundary.doorId && map.doors) {
              const door = map.doors.find((dr) => dr.id === boundary.doorId);
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
            let canTraverse = boundary.type === BoundaryType.Open;
            if (boundary.doorId && map.doors) {
              const door = map.doors.find((dr) => dr.id === boundary.doorId);
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

      if (map.objectives) {
        for (const obj of map.objectives) {
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
}
