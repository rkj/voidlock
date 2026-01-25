import { Vector2, BoundaryType } from "@src/shared/types";
import { Graph } from "@src/engine/Graph";

type Segment = { p1: Vector2; p2: Vector2 };

export class VisibilityPolygon {
  private static getSegments(
    graph: Graph,
    origin: Vector2,
    range: number,
  ): Segment[] {
    const segments: Segment[] = [];

    // Add "Horizon" segments (bounding box of range)
    // This ensures there are always segments to cast rays against, preventing empty polygons in open space.
    segments.push({
      p1: { x: origin.x - range, y: origin.y - range },
      p2: { x: origin.x + range, y: origin.y - range },
    });
    segments.push({
      p1: { x: origin.x + range, y: origin.y - range },
      p2: { x: origin.x + range, y: origin.y + range },
    });
    segments.push({
      p1: { x: origin.x + range, y: origin.y + range },
      p2: { x: origin.x - range, y: origin.y + range },
    });
    segments.push({
      p1: { x: origin.x - range, y: origin.y + range },
      p2: { x: origin.x - range, y: origin.y - range },
    });

    // Grid Walls from Graph Boundaries
    for (const boundary of graph.getAllBoundaries()) {
      if (boundary.type !== BoundaryType.Open) {
        segments.push(boundary.getVisualSegment());
      }
    }

    return segments;
  }

  private static getIntersection(
    rayOrigin: Vector2,
    rayDir: Vector2,
    segment: Segment,
  ): { param: number; point: Vector2 } | null {
    // Ray: P + t * R
    // Segment: Q + u * S
    const p = rayOrigin;
    const r = rayDir;
    const q = segment.p1;
    const s = {
      x: segment.p2.x - segment.p1.x,
      y: segment.p2.y - segment.p1.y,
    };

    const cross = (v1: Vector2, v2: Vector2) => v1.x * v2.y - v1.y * v2.x;
    const rXs = cross(r, s);

    if (rXs === 0) return null; // Parallel

    const qMp = { x: q.x - p.x, y: q.y - p.y };
    const t = cross(qMp, s) / rXs;
    const u = cross(qMp, r) / rXs;

    if (t >= 0 && u >= 0 && u <= 1) {
      return {
        param: t,
        point: { x: p.x + t * r.x, y: p.y + t * r.y },
      };
    }

    return null;
  }

  public static compute(
    origin: Vector2,
    graph: Graph,
    range?: number,
  ): Vector2[] {
    const actualRange = range ?? graph.width + graph.height;
    const segments = this.getSegments(graph, origin, actualRange);
    const points: Vector2[] = [];
    const uniquePoints = new Set<string>();

    // Add segment endpoints to points list
    for (const seg of segments) {
      const k1 = `${seg.p1.x},${seg.p1.y}`;
      const k2 = `${seg.p2.x},${seg.p2.y}`;
      if (!uniquePoints.has(k1)) {
        uniquePoints.add(k1);
        points.push(seg.p1);
      }
      if (!uniquePoints.has(k2)) {
        uniquePoints.add(k2);
        points.push(seg.p2);
      }
    }

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
      let closestDist = actualRange;
      let closestPoint = {
        x: origin.x + dx * actualRange,
        y: origin.y + dy * actualRange,
      };

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
