import { Grid, Vector2, Door } from '../shared/types';

export class LineOfSight {
  constructor(private grid: Grid, private doors: Map<string, Door>) {}

  public computeVisibleCells(origin: Vector2, range: number): string[] {
    const visible: Set<string> = new Set();
    const rangeSq = range * range;

    const startX = Math.floor(origin.x);
    const startY = Math.floor(origin.y);

    const minX = Math.max(0, startX - Math.ceil(range));
    const maxX = Math.min(this.grid.width - 1, startX + Math.ceil(range));
    const minY = Math.max(0, startY - Math.ceil(range));
    const maxY = Math.min(this.grid.height - 1, startY + Math.ceil(range));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
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

  public hasLineOfSight(start: Vector2, end: Vector2): boolean {
    let x0 = Math.floor(start.x);
    let y0 = Math.floor(start.y);
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
    
    for(let i = 0; i < maxSteps; i++) {
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

        // Check wall passage, passing the doors map
        if (!this.grid.canMove(x, y, nextX, nextY, this.doors)) {
            return false;
        }
        
        x = nextX;
        y = nextY;
    }

    return true;
  }
}