import { Grid, Vector2 } from '../shared/types';

export class LineOfSight {
  constructor(private grid: Grid) {}

  public computeVisibleCells(origin: Vector2, range: number): string[] {
    const visible: Set<string> = new Set();
    const rangeSq = range * range;

    const startX = Math.floor(origin.x);
    const startY = Math.floor(origin.y);

    // Naive approach: raycast to every cell in bounding box
    const minX = Math.max(0, startX - Math.ceil(range));
    const maxX = Math.min(this.grid.width - 1, startX + Math.ceil(range));
    const minY = Math.max(0, startY - Math.ceil(range));
    const maxY = Math.min(this.grid.height - 1, startY + Math.ceil(range));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        // Check distance
        const dx = x + 0.5 - origin.x;
        const dy = y + 0.5 - origin.y;
        if (dx * dx + dy * dy <= rangeSq) {
          if (this.hasLineOfSight(origin, { x: x + 0.5, y: y + 0.5 })) {
            visible.add(`${x},${y}`);
          }
        }
      }
    }

    return Array.from(visible);
  }

  // Check if a line from start to end is clear
  private hasLineOfSight(start: Vector2, end: Vector2): boolean {
    let x0 = Math.floor(start.x);
    let y0 = Math.floor(start.y);
    const x1 = Math.floor(end.x);
    const y1 = Math.floor(end.y);

    if (x0 === x1 && y0 === y1) return true;

    // Bresenham-like grid traversal (DDA)
    // Based on "A Fast Voxel Traversal Algorithm for Ray Tracing" by Amanatides and Woo
    
    // Direction vector
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    // Step direction
    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);

    // tMax: value of t at which ray crosses next boundary
    // tDelta: how far along ray we must move to cross a grid width/height
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

    // Max steps just in case, though we have bounds
    const maxSteps = Math.abs(x1 - x0) + Math.abs(y1 - y0) + 10;
    
    for(let i = 0; i < maxSteps; i++) {
        // If we hit a wall, LOS blocked
        // NOTE: We allow seeing the *wall* itself, but not past it.
        // So check blockage *before* stepping? No, standard is:
        // Current cell is (x,y). If it's a wall, we can see IT, but not further?
        // Usually, walls block LOS. If (x,y) is a wall, we stop.
        // But we want to include the wall in visible set.
        // The calling loop iterates target cells. 
        // If the ray hits a wall *before* reaching target, blocked.
        // If the target *is* the wall, it is visible.
        
        if (x === x1 && y === y1) return true; // Reached target

        if (!this.grid.isWalkable(x, y)) {
            // It's a wall (or unwalkable). 
            // Since we are traversing, if we hit a wall and haven't reached target yet, we are blocked.
            return false;
        }

        if (tMaxX < tMaxY) {
            tMaxX += tDeltaX;
            x += stepX;
        } else {
            tMaxY += tDeltaY;
            y += stepY;
        }
    }

    return true;
  }
}
