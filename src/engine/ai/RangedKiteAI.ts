import {
  GameState,
  Enemy,
  Unit,
  UnitState,
  Vector2,
  Grid,
  CommandType,
} from "../../shared/types";
import { Pathfinder } from "../Pathfinder";
import { PRNG } from "../../shared/PRNG";
import { LineOfSight } from "../LineOfSight";
import { IEnemyAI } from "./EnemyAI";

export class RangedKiteAI implements IEnemyAI {
  think(
    enemy: Enemy,
    state: GameState,
    grid: Grid,
    pathfinder: Pathfinder,
    los: LineOfSight,
    prng: PRNG,
  ): void {
    if (enemy.hp <= 0) return;

    // 1. Detection
    const visibleSoldiers = state.units.filter((u) => {
      const d = this.getDistance(enemy.pos, u.pos);
      const losCheck = los.hasLineOfSight(enemy.pos, u.pos);
      return (
        u.hp > 0 &&
        u.state !== UnitState.Extracted &&
        u.state !== UnitState.Dead &&
        d <= 12 &&
        losCheck
      );
    });

    let targetSoldier: Unit | null = null;
    let minDistance = Infinity;

    visibleSoldiers.forEach((u) => {
      const dist = this.getDistance(enemy.pos, u.pos);
      if (dist < minDistance) {
        minDistance = dist;
        targetSoldier = u;
      }
    });

    if (targetSoldier) {
      const dist = minDistance;
      const optimalRange = enemy.attackRange - 1; // Try to stay at range-1
      const fleeThreshold = 3;

      // Behavior:
      // 1. If too close (< fleeThreshold): Flee.
      // 2. If optimal < dist < detection: Move closer.
      // 3. If dist <= optimal: Stop and shoot (CoreEngine handles shooting if in range/visible).

      // Flee or Chase?
      if (dist < fleeThreshold) {
        // Flee: Find a cell further away
        const fleeTarget = this.findFleeTarget(
          enemy.pos,
          (targetSoldier as Unit).pos,
          grid,
          pathfinder,
        );
        if (fleeTarget) {
          enemy.targetPos = fleeTarget;
          // Simple move, no path cache for fleeing to stay reactive?
          // Or pathfind. Pathfind is safer.
          const path = pathfinder.findPath(
            { x: Math.floor(enemy.pos.x), y: Math.floor(enemy.pos.y) },
            { x: Math.floor(fleeTarget.x), y: Math.floor(fleeTarget.y) },
          );
          if (path && path.length > 0) {
            enemy.path = path;
            enemy.targetPos = { x: path[0].x + 0.5, y: path[0].y + 0.5 };
          }
        }
      } else if (dist > optimalRange) {
        // Chase
        const targetPos = (targetSoldier as Unit).pos;
        const path = pathfinder.findPath(
          { x: Math.floor(enemy.pos.x), y: Math.floor(enemy.pos.y) },
          { x: Math.floor(targetPos.x), y: Math.floor(targetPos.y) },
        );
        if (path && path.length > 0) {
          enemy.path = path;
          enemy.targetPos = { x: path[0].x + 0.5, y: path[0].y + 0.5 };
        }
      } else {
        // In range. Hold position to fire.
        enemy.path = [];
        enemy.targetPos = undefined;
      }
    } else {
      // 3. Roam Mode (Same as Melee)
      this.roam(enemy, grid, pathfinder, prng);
    }
  }

  private roam(enemy: Enemy, grid: Grid, pathfinder: Pathfinder, prng: PRNG) {
    if ((!enemy.path || enemy.path.length === 0) && !enemy.targetPos) {
      const currentX = Math.floor(enemy.pos.x);
      const currentY = Math.floor(enemy.pos.y);
      const roamRadius = 10;

      let attempts = 0;
      while (attempts < 5) {
        const tx = prng.nextInt(
          Math.max(0, currentX - roamRadius),
          Math.min(grid.width - 1, currentX + roamRadius),
        );
        const ty = prng.nextInt(
          Math.max(0, currentY - roamRadius),
          Math.min(grid.height - 1, currentY + roamRadius),
        );

        if (grid.isWalkable(tx, ty) && (tx !== currentX || ty !== currentY)) {
          const path = pathfinder.findPath(
            { x: currentX, y: currentY },
            { x: tx, y: ty },
          );
          if (path && path.length > 0) {
            enemy.path = path;
            enemy.targetPos = { x: path[0].x + 0.5, y: path[0].y + 0.5 };
            break;
          }
        }
        attempts++;
      }
    }
  }

  private findFleeTarget(
    start: Vector2,
    threat: Vector2,
    grid: Grid,
    pathfinder: Pathfinder,
  ): Vector2 | null {
    // Try random directions away from threat
    const candidates = [
      { x: start.x + 2, y: start.y },
      { x: start.x - 2, y: start.y },
      { x: start.x, y: start.y + 2 },
      { x: start.x, y: start.y - 2 },
      { x: start.x + 2, y: start.y + 2 }, // Diagonals
      { x: start.x - 2, y: start.y - 2 },
    ];

    let best: Vector2 | null = null;
    let maxDist = this.getDistance(start, threat);

    for (const c of candidates) {
      const cx = Math.floor(c.x);
      const cy = Math.floor(c.y);
      if (grid.isWalkable(cx, cy)) {
        const dist = this.getDistance(c, threat);
        if (dist > maxDist) {
          // Ensure reachable
          const path = pathfinder.findPath(
            { x: Math.floor(start.x), y: Math.floor(start.y) },
            { x: cx, y: cy },
          );
          if (path) {
            maxDist = dist;
            best = { x: cx + 0.5, y: cy + 0.5 };
          }
        }
      }
    }
    return best;
  }

  private getDistance(p1: Vector2, p2: Vector2): number {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  }
}
