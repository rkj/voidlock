import { Vector2, Door, CellType } from "../shared/types";
import { Graph } from "./Graph";

export class LineOfSight {
  constructor(
    private graph: Graph,
    private doors: Map<string, Door>,
  ) {}

  public computeVisibleCells(origin: Vector2, range: number): string[] {
    const visible: Set<string> = new Set();
    const originCellX = Math.floor(origin.x);
    const originCellY = Math.floor(origin.y);

    // Iterate through a bounding box around the origin, centered on cells
    const searchRange = Math.ceil(range);
    const minX = Math.max(0, originCellX - searchRange);
    const maxX = Math.min(this.graph.width - 1, originCellX + searchRange);
    const minY = Math.max(0, originCellY - searchRange);
    const maxY = Math.min(this.graph.height - 1, originCellY + searchRange);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        // Check distance to cell center
        const cellCenterX = x + 0.5;
        const cellCenterY = y + 0.5;
        const distSq =
          (cellCenterX - origin.x) ** 2 + (cellCenterY - origin.y) ** 2;

        if (distSq <= range * range) {
          if (this.hasLineOfSight(origin, { x: cellCenterX, y: cellCenterY })) {
            visible.add(`${x},${y}`);
          }
        }
      }
    }

    return Array.from(visible);
  }

  public hasLineOfSight(start: Vector2, end: Vector2): boolean {
    // Add small epsilon to start position towards end to avoid boundary singularities
    const dxRaw = end.x - start.x;
    const dyRaw = end.y - start.y;
    const len = Math.sqrt(dxRaw * dxRaw + dyRaw * dyRaw);

    let curX = start.x;
    let curY = start.y;

    if (len > 0.001) {
      curX += (dxRaw / len) * 0.001;
      curY += (dyRaw / len) * 0.001;
    }

    let x0 = Math.floor(curX);
    let y0 = Math.floor(curY);
    const x1 = Math.floor(end.x);
    const y1 = Math.floor(end.y);

    if (x0 === x1 && y0 === y1) return true;

    const dx = end.x - start.x;
    const dy = end.y - start.y;

    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);

    let tMaxX = 0;
    let tMaxY = 0;
    const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity;

    if (stepX > 0) {
      tMaxX = (Math.floor(start.x) + 1 - start.x) * tDeltaX;
    } else if (stepX < 0) {
      tMaxX = (start.x - Math.floor(start.x)) * tDeltaX;
    } else {
      tMaxX = Infinity;
    }

    if (stepY > 0) {
      tMaxY = (Math.floor(start.y) + 1 - start.y) * tDeltaY;
    } else if (stepY < 0) {
      tMaxY = (start.y - Math.floor(start.y)) * tDeltaY;
    } else {
      tMaxY = Infinity;
    }

    let x = x0;
    let y = y0;

    const maxSteps = Math.abs(x1 - x0) + Math.abs(y1 - y0) + 10;

    for (let i = 0; i < maxSteps; i++) {
      if (x === x1 && y === y1) return true;

      // Determine next step
      let nextX = x;
      let nextY = y;

      if (tMaxX < tMaxY) {
        tMaxX += tDeltaX;
        nextX += stepX;
      } else {
        tMaxY += tDeltaY;
        nextY += stepY;
      }

      // Direct Boundary Check
      const boundary = this.graph.getBoundary(x, y, nextX, nextY);
      if (!boundary) return false;

      if (boundary.doorId) {
        const door = this.doors.get(boundary.doorId);
        if (
          door &&
          door.state !== "Open" &&
          door.state !== "Destroyed" &&
          door.targetState !== "Open"
        ) {
          return false;
        }
      } else if (boundary.isWall) {
        return false;
      }

      if (this.graph.cells[nextY][nextX].type === CellType.Wall) {
        // Blocked by void/wall cell, but allow seeing the cell itself if it's the target
        return nextX === x1 && nextY === y1;
      }

      x = nextX;
      y = nextY;
    }

    return true;
  }
}
