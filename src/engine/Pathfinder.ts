import { Vector2, Door, CellType } from '../shared/types';
import { Graph } from './Graph';

export class Pathfinder {
  constructor(private graph: Graph, private doors: Map<string, Door>) {}

  findPath(start: Vector2, end: Vector2): Vector2[] | null {
    if (end.x < 0 || end.x >= this.graph.width || end.y < 0 || end.y >= this.graph.height) {
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

        if (neighbor.x < 0 || neighbor.x >= this.graph.width || neighbor.y < 0 || neighbor.y >= this.graph.height) {
          continue;
        }

        if (this.graph.cells[neighbor.y][neighbor.x].type !== CellType.Floor) {
          continue;
        }

        if (visited.has(neighborKey)) {
          continue;
        }

        const boundary = this.graph.getBoundary(current.x, current.y, neighbor.x, neighbor.y);
        if (!boundary) continue;

        let canTraverse = !boundary.isWall;
        if (boundary.doorId) {
          const door = this.doors.get(boundary.doorId);
          // Pathfinding treats Closed, Open, and Destroyed doors as passable.
          // Locked doors should still block pathfinding.
          canTraverse = door ? door.state !== 'Locked' : !boundary.isWall;
        }

        if (canTraverse) {
          visited.add(neighborKey);
          parent.set(neighborKey, current);
          queue.push(neighbor);
        }
      }
    }

    return null; // No path found
  }

  private reconstructPath(
    parent: Map<string, Vector2>,
    start: Vector2,
    end: Vector2
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
