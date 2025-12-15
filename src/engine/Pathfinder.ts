import { Grid, Vector2, Door } from '../shared/types';

export class Pathfinder {
  constructor(private grid: Grid, private doors: Map<string, Door>) {}

  findPath(start: Vector2, end: Vector2): Vector2[] | null {
    if (!this.grid.isWalkable(end.x, end.y)) {
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

        if (
          this.grid.canMove(current.x, current.y, neighbor.x, neighbor.y, this.doors, false) &&
          !visited.has(neighborKey)
        ) {
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