import {
  MapDefinition,
  CellType,
  BoundaryType,
  WallDefinition,
} from "../../shared/types";
import { Graph, Direction } from "../Graph";

export class MapSanitizer {
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
        if (
          boundary &&
          (boundary.type === BoundaryType.Open ||
            boundary.type === BoundaryType.Door)
        ) {
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

    // 2. Filter unreachable and Omit Void cells
    map.cells = map.cells.filter((cellDef) => {
      const key = `${cellDef.x},${cellDef.y}`;
      if (reachable.has(key)) {
        cellDef.type = CellType.Floor;
        return true;
      }
      return false;
    });

    // 3. Re-build map.walls from Graph (ensuring unreachable cells are walled off)
    const newWalls: WallDefinition[] = [];
    const newBoundaries: any[] = [];

    for (const b of graph.getAllBoundaries()) {
      const isC1Reachable = reachable.has(`${b.x1},${b.y1}`);
      const isC2Reachable = reachable.has(`${b.x2},${b.y2}`);

      // A boundary should be a wall if it separates a reachable cell from an unreachable one,
      // or if it was already a wall between two reachable cells.
      let shouldBeWall = b.type === BoundaryType.Wall;
      if (isC1Reachable !== isC2Reachable) {
        shouldBeWall = true;
      }

      // If it's a door, but connects to an unreachable cell, it MUST become a wall.
      const isDoor = b.type === BoundaryType.Door;
      const isValidDoor = isDoor && isC1Reachable && isC2Reachable;

      if (shouldBeWall && !isValidDoor) {
        const seg = b.getVisualSegment();
        newWalls.push({ p1: seg.p1, p2: seg.p2 });
      }

      newBoundaries.push({
        x1: b.x1,
        y1: b.y1,
        x2: b.x2,
        y2: b.y2,
        type: isValidDoor
          ? BoundaryType.Door
          : shouldBeWall
            ? BoundaryType.Wall
            : BoundaryType.Open,
        doorId: isValidDoor ? b.doorId : undefined,
      });
    }
    map.walls = newWalls;
    if (map.boundaries) {
      map.boundaries = newBoundaries;
    }

    // 4. Remove Doors connected to Void
    if (map.doors) {
      map.doors = map.doors.filter((door) => {
        if (door.segment.length !== 2) return false;
        const [s1, s2] = door.segment;
        return (
          reachable.has(`${s1.x},${s1.y}`) && reachable.has(`${s2.x},${s2.y}`)
        );
      });
    }
  }
}
