import { Vector2, MapDefinition, CellType, Door } from '../shared/types';

type Segment = { p1: Vector2; p2: Vector2 };

export class VisibilityPolygon {
  private static getSegments(map: MapDefinition, origin: Vector2, range: number): Segment[] {
    const segments: Segment[] = [];
    const minX = Math.floor(origin.x - range);
    const maxX = Math.ceil(origin.x + range);
    const minY = Math.floor(origin.y - range);
    const maxY = Math.ceil(origin.y + range);

    // Add "Horizon" segments (bounding box of range)
    // This ensures there are always segments to cast rays against, preventing empty polygons in open space.
    segments.push({ p1: { x: origin.x - range, y: origin.y - range }, p2: { x: origin.x + range, y: origin.y - range } });
    segments.push({ p1: { x: origin.x + range, y: origin.y - range }, p2: { x: origin.x + range, y: origin.y + range } });
    segments.push({ p1: { x: origin.x + range, y: origin.y + range }, p2: { x: origin.x - range, y: origin.y + range } });
    segments.push({ p1: { x: origin.x - range, y: origin.y + range }, p2: { x: origin.x - range, y: origin.y - range } });

    // Grid Walls
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        
        const cell = map.cells.find(c => c.x === x && c.y === y);
        if (!cell) continue; // Void is implicitly blocking? Or just empty? 
                             // In this engine, Void cells usually don't exist in cell list or are ignored.
                             // But CellType.Wall means "Solid".
        
        if (cell.type === CellType.Wall) {
             // A full block wall. Add all 4 sides?
             // Actually, if it's a "Wall" cell, it blocks everything.
             // But the game uses "Thin Walls" mainly now?
             // Let's check "M7: Thin Walls".
        }
        
        // Add Thin Walls
        if (cell.walls.n) segments.push({ p1: { x, y }, p2: { x: x + 1, y } });
        if (cell.walls.e) segments.push({ p1: { x: x + 1, y }, p2: { x: x + 1, y: y + 1 } });
        if (cell.walls.s) segments.push({ p1: { x, y: y + 1 }, p2: { x: x + 1, y: y + 1 } });
        if (cell.walls.w) segments.push({ p1: { x, y }, p2: { x, y: y + 1 } });
      }
    }
    
    // Doors (Closed/Locked act as walls)
    if (map.doors) {
        for (const door of map.doors) {
            if (door.state === 'Closed' || door.state === 'Locked') {
                 // Check if door is within range
                 // Door segments are already defined in grid coords
                 if (door.segment.length === 2) {
                     // Check if at least one point is close
                     const d1 = (door.segment[0].x - origin.x)**2 + (door.segment[0].y - origin.y)**2;
                     if (d1 < (range + 2)**2) {
                        segments.push({ p1: door.segment[0], p2: door.segment[1] });
                     }
                 }
            }
        }
    }

    return segments;
  }

  private static getIntersection(rayOrigin: Vector2, rayDir: Vector2, segment: Segment): { param: number, point: Vector2 } | null {
      // Ray: O + t * D
      // Segment: P1 + u * (P2 - P1)
      const r_px = rayOrigin.x;
      const r_py = rayOrigin.y;
      const r_dx = rayDir.x;
      const r_dy = rayDir.y;

      const s_px = segment.p1.x;
      const s_py = segment.p1.y;
      const s_dx = segment.p2.x - segment.p1.x;
      const s_dy = segment.p2.y - segment.p1.y;

      const r_mag = Math.sqrt(r_dx*r_dx + r_dy*r_dy);
      const s_mag = Math.sqrt(s_dx*s_dx + s_dy*s_dy);

      if (r_dx/r_mag === s_dx/s_mag && r_dy/r_mag === s_dy/s_mag) return null; // Parallel

      const T2 = (r_dx * (s_py - r_py) + r_dy * (r_px - s_px)) / (s_dx * r_dy - s_dy * r_dx);
      const T1 = (s_px + s_dx * T2 - r_px) / r_dx;

      // Check if T2 is within [0, 1] (segment bounds) and T1 > 0 (ray direction)
      // T1 is distance along ray if ray is normalized? No, T1 scales rayDir.
      // But we can just use T1.
      
      // Robust intersection check
      // t = (q - p) x s / (r x s)
      // u = (q - p) x r / (r x s)
      
      const r = { x: r_dx, y: r_dy };
      const s = { x: s_dx, y: s_dy };
      const p = rayOrigin;
      const q = segment.p1;
      
      const cross = (v1: Vector2, v2: Vector2) => v1.x * v2.y - v1.y * v2.x;
      const rXs = cross(r, s);
      
      if (rXs === 0) return null; // Parallel
      
      const qMp = { x: q.x - p.x, y: q.y - p.y };
      const t = cross(qMp, s) / rXs;
      const u = cross(qMp, r) / rXs;
      
      if (rXs !== 0 && t >= 0 && u >= 0 && u <= 1) {
          return {
              param: t,
              point: { x: p.x + t * r.x, y: p.y + t * r.y }
          };
      }
      
      return null;
  }

  public static compute(origin: Vector2, range: number, map: MapDefinition): Vector2[] {
      const segments = this.getSegments(map, origin, range);
      const points: Vector2[] = [];
      const uniquePoints = new Set<string>();

      // Add segment endpoints to points list
      for (const seg of segments) {
          const k1 = `${seg.p1.x},${seg.p1.y}`;
          const k2 = `${seg.p2.x},${seg.p2.y}`;
          if (!uniquePoints.has(k1)) { uniquePoints.add(k1); points.push(seg.p1); }
          if (!uniquePoints.has(k2)) { uniquePoints.add(k2); points.push(seg.p2); }
      }
      
      // Also add box corners if they are within range?
      // Or just let the ray cast hit max range
      
      const angles: number[] = [];
      for (const p of points) {
          const angle = Math.atan2(p.y - origin.y, p.x - origin.x);
          angles.push(angle - 0.00001);
          angles.push(angle);
          angles.push(angle + 0.00001);
      }

      const polygon: Vector2[] = [];
      
      // Sort angles
      angles.sort((a, b) => a - b);

      for (const angle of angles) {
          const dx = Math.cos(angle);
          const dy = Math.sin(angle);
          const rayDir = { x: dx, y: dy };
          
          // Find closest intersection
          let closestDist = range;
          let closestPoint = { x: origin.x + dx * range, y: origin.y + dy * range };

          for (const seg of segments) {
              const hit = this.getIntersection(origin, rayDir, seg);
              if (hit) {
                  if (hit.param < closestDist) {
                      closestDist = hit.param;
                      closestPoint = hit.point;
                  }
              }
          }
          polygon.push(closestPoint);
      }

      return polygon;
  }
}
