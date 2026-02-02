import { Vector2, Door, CellType, BoundaryType } from "../shared/types";
import { Graph, Boundary } from "./Graph";
import { UNIT_RADIUS } from "./config/GameConstants";
import { MathUtils } from "../shared/utils/MathUtils";

export class LineOfSight {
  constructor(
    private graph: Graph,
    private doors: Map<string, Door>,
  ) {}

  /**
   * Computes all visible cells from a given origin within an optional range.
   * Uses geometric raycasting to determine visibility.
   */
  public computeVisibleCells(origin: Vector2, range?: number): string[] {
    const visible: Set<string> = new Set();
    const originCellX = Math.floor(origin.x);
    const originCellY = Math.floor(origin.y);

    const actualRange =
      range !== undefined ? range : this.graph.width + this.graph.height;

    // Iterate through a bounding box around the origin, centered on cells
    const searchRange = Math.ceil(actualRange);
    const minX = Math.max(0, originCellX - searchRange);
    const maxX = Math.min(this.graph.width - 1, originCellX + searchRange);
    const minY = Math.max(0, originCellY - searchRange);
    const maxY = Math.min(this.graph.height - 1, originCellY + searchRange);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        // Check distance to cell center
        const cellCenterX = x + 0.5;
        const cellCenterY = y + 0.5;
        const distSq = MathUtils.getDistanceSquared(origin, {
          x: cellCenterX,
          y: cellCenterY,
        });

        if (distSq <= actualRange * actualRange) {
          if (this.hasLineOfSight(origin, { x: cellCenterX, y: cellCenterY })) {
            visible.add(`${x},${y}`);
          }
        }
      }
    }

    return Array.from(visible);
  }

  /**
   * Updates the bitset gridState with visibility and discovery info from an origin.
   * bit 0: visible, bit 1: discovered.
   */
  public updateVisibleCells(
    origin: Vector2,
    gridState: Uint8Array,
    width: number,
    height: number,
    range?: number,
  ): void {
    const originCellX = Math.floor(origin.x);
    const originCellY = Math.floor(origin.y);

    const actualRange = range !== undefined ? range : width + height;

    const searchRange = Math.ceil(actualRange);
    const minX = Math.max(0, originCellX - searchRange);
    const maxX = Math.min(width - 1, originCellX + searchRange);
    const minY = Math.max(0, originCellY - searchRange);
    const maxY = Math.min(height - 1, originCellY + searchRange);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cellCenterX = x + 0.5;
        const cellCenterY = y + 0.5;
        const distSq = MathUtils.getDistanceSquared(origin, {
          x: cellCenterX,
          y: cellCenterY,
        });

        if (distSq <= actualRange * actualRange) {
          if (this.hasLineOfSight(origin, { x: cellCenterX, y: cellCenterY })) {
            gridState[y * width + x] |= 3; // bit 0: visible, bit 1: discovered
          }
        }
      }
    }
  }

  /**
   * Determines if there is a clear line of sight between two points.
   * LOS uses "at least one ray" logic: if any ray from the sampled fat ray
   * passes through, the target is visible.
   * Blocks on walls and non-open doors. Also accounts for door struts (outer 1/3 of boundary).
   */
  public hasLineOfSight(start: Vector2, end: Vector2): boolean {
    const rays = this.getSampledRays(start, end);
    return rays.some((ray) =>
      this.raycast(ray.start, ray.end, (boundary, frac) => {
        if (boundary.doorId) {
          // Door struts (outer 1/3) always block LOS
          if (frac < 1 / 3 || frac > 2 / 3) {
            return false;
          }

          const door = this.doors.get(boundary.doorId);
          if (
            door &&
            door.state !== "Open" &&
            door.state !== "Destroyed" &&
            door.targetState !== "Open"
          ) {
            return false;
          }
        } else if (boundary.type === BoundaryType.Wall) {
          return false;
        }
        return true;
      }),
    );
  }

  /**
   * Determines if there is a clear line of fire between two points.
   * LOF uses "all rays" logic: every ray in the fat ray must be clear.
   * Strictly requires doors to be fully Open or Destroyed.
   */
  public hasLineOfFire(start: Vector2, end: Vector2): boolean {
    if (
      Math.floor(start.x) === Math.floor(end.x) &&
      Math.floor(start.y) === Math.floor(end.y)
    ) {
      return true;
    }
    const rays = this.getSampledRays(start, end);
    return rays.every((ray) =>
      this.raycast(ray.start, ray.end, (boundary, frac) => {
        if (boundary.doorId) {
          // Door struts (outer 1/3) always block LOF
          if (frac < 1 / 3 || frac > 2 / 3) {
            return false;
          }

          const door = this.doors.get(boundary.doorId);
          if (door && door.state !== "Open" && door.state !== "Destroyed") {
            return false;
          }
        } else if (boundary.type === BoundaryType.Wall) {
          return false;
        }
        return true;
      }),
    );
  }

  /**
   * Samples a "fat ray" between two points using the UNIT_RADIUS.
   * Returns three rays: center, and two parallel offset rays.
   */
  private getSampledRays(
    start: Vector2,
    end: Vector2,
  ): { start: Vector2; end: Vector2 }[] {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = MathUtils.getDistance(start, end);

    if (len < 0.001) return [{ start, end }];

    const ux = dx / len;
    const uy = dy / len;

    // Perpendicular vector
    const px = -uy;
    const py = ux;

    return [
      { start, end }, // Center
      {
        start: { x: start.x + px * UNIT_RADIUS, y: start.y + py * UNIT_RADIUS },
        end: { x: end.x + px * UNIT_RADIUS, y: end.y + py * UNIT_RADIUS },
      },
      {
        start: { x: start.x - px * UNIT_RADIUS, y: start.y - py * UNIT_RADIUS },
        end: { x: end.x - px * UNIT_RADIUS, y: end.y - py * UNIT_RADIUS },
      },
    ];
  }

  /**
   * Core raycasting implementation using Amanatides-Woo algorithm.
   * Traverses the grid cell-by-cell along the ray.
   */
  private raycast(
    start: Vector2,
    end: Vector2,
    isPassable: (boundary: Boundary, frac: number) => boolean,
  ): boolean {
    // Add small epsilon to start position towards end to avoid boundary singularities
    const dxRaw = end.x - start.x;
    const dyRaw = end.y - start.y;
    const len = MathUtils.getDistance(start, end);

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
      let tInter = 0;

      if (tMaxX < tMaxY) {
        tInter = tMaxX;
        tMaxX += tDeltaX;
        nextX += stepX;
      } else {
        tInter = tMaxY;
        tMaxY += tDeltaY;
        nextY += stepY;
      }

      // Intersection point
      const ix = start.x + tInter * dx;
      const iy = start.y + tInter * dy;

      // Direct Boundary Check
      const boundary = this.graph.getBoundary(x, y, nextX, nextY);
      if (!boundary) return false;

      // Fractional coordinate along boundary (0 to 1)
      let frac = 0;
      if (x === nextX) {
        // Horizontal boundary (step in Y)
        frac = ix - Math.floor(ix);
      } else {
        // Vertical boundary (step in X)
        frac = iy - Math.floor(iy);
      }

      if (!isPassable(boundary, frac)) {
        return false;
      }

      if (this.graph.cells[nextY][nextX].type === CellType.Void) {
        // Blocked by void/wall cell, but allow seeing the cell itself if it's the target
        return nextX === x1 && nextY === y1;
      }

      x = nextX;
      y = nextY;
    }

    return true;
  }
}
