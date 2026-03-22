import type { Vector2, Door} from "../shared/types";
import { CellType, BoundaryType } from "../shared/types";
import type { Graph } from "./Graph";

export class Pathfinder {
  constructor(
    private graph: Graph,
    private doors: Map<string, Door>,
  ) {}

  /**
   * Finds a path between two points on the grid using Breadth-First Search (BFS).
   *
   * The algorithm respects:
   * 1. Cell type (must be Floor).
   * 2. Boundaries (must not be a wall).
   * 3. Doors:
   *    - If allowClosedDoors is false: Only Open or Destroyed doors are traversable.
   *    - If allowClosedDoors is true: Any non-Locked door is traversable (used for intent-based pathing).
   *
   * @param start Starting coordinates
   * @param end Target coordinates
   * @param allowClosedDoors Whether to consider closed (but unlocked) doors as walkable
   * @returns Array of coordinates representing the path (excluding start), or null if no path exists.
   */
  findPath(
    start: Vector2,
    end: Vector2,
    allowClosedDoors: boolean = false,
  ): Vector2[] | null {
    if (!this.isInBounds(end.x, end.y)) {
      return null;
    }
    if (this.graph.cells[end.y][end.x].type !== CellType.Floor) {
      return null;
    }

    const queue: Vector2[] = [];
    const visited: Set<string> = new Set();
    const parent: Map<string, Vector2> = new Map();

    queue.push(start);
    visited.add(`${start.x},${start.y}`);

    const directions = [
      { dx: 0, dy: 1 }, // Down
      { dx: 0, dy: -1 }, // Up
      { dx: 1, dy: 0 }, // Right
      { dx: -1, dy: 0 }, // Left
    ];

    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];

      if (current.x === end.x && current.y === end.y) {
        return this.reconstructPath(parent, start, end);
      }

      for (const dir of directions) {
        const neighbor = { x: current.x + dir.dx, y: current.y + dir.dy };
        const neighborKey = `${neighbor.x},${neighbor.y}`;

        if (!this.isInBounds(neighbor.x, neighbor.y)) continue;
        if (this.graph.cells[neighbor.y][neighbor.x].type !== CellType.Floor) continue;
        if (visited.has(neighborKey)) continue;

        const boundary = this.graph.getBoundary(
          current.x,
          current.y,
          neighbor.x,
          neighbor.y,
        );
        if (!boundary) continue;

        if (!this.canTraverseBoundary(boundary, allowClosedDoors)) continue;

        visited.add(neighborKey);
        parent.set(neighborKey, current);
        queue.push(neighbor);
      }
    }

    return null; // No path found
  }

  private isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.graph.width && y >= 0 && y < this.graph.height;
  }

  private canTraverseBoundary(
    boundary: { type: BoundaryType; doorId?: string },
    allowClosedDoors: boolean,
  ): boolean {
    if (!boundary.doorId) {
      return boundary.type === BoundaryType.Open;
    }
    const door = this.doors.get(boundary.doorId);
    if (!door) return boundary.type === BoundaryType.Open;
    if (allowClosedDoors) return door.state !== "Locked";
    return door.state === "Open" || door.state === "Destroyed";
  }

  private reconstructPath(
    parent: Map<string, Vector2>,
    start: Vector2,
    end: Vector2,
  ): Vector2[] {
    const path: Vector2[] = [];
    let current: Vector2 | undefined = end;
    while (current && !(current.x === start.x && current.y === start.y)) {
      path.unshift(current);
      current = parent.get(`${current.x},${current.y}`);
    }
    return path;
  }
}
