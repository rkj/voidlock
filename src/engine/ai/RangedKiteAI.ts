import {
  GameState,
  Enemy,
  Unit,
  UnitState,
  Vector2,
  Grid,
} from "../../shared/types";
import { Pathfinder } from "../Pathfinder";
import { PRNG } from "../../shared/PRNG";
import { LineOfSight } from "../LineOfSight";
import { IEnemyAI } from "./EnemyAI";
import { MathUtils } from "../../shared/utils/MathUtils";
import { AI } from "../config/GameConstants";

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

    // 1. Stickiness: Check if current forcedTarget is still valid
    let targetSoldier: Unit | null = null;
    if (
      enemy.forcedTargetId &&
      enemy.targetLockUntil &&
      state.t < enemy.targetLockUntil
    ) {
      const sticky = state.units.find((u) => u.id === enemy.forcedTargetId);
      if (
        sticky &&
        sticky.hp > 0 &&
        sticky.state !== UnitState.Extracted &&
        sticky.state !== UnitState.Dead
      ) {
        if (
          MathUtils.getDistance(enemy.pos, sticky.pos) <= 15 &&
          los.hasLineOfSight(enemy.pos, sticky.pos)
        ) {
          targetSoldier = sticky;
        }
      }
    }

    // 2. Detection (if no sticky target)
    if (!targetSoldier) {
      const visibleSoldiers = state.units.filter((u) => {
        const d = MathUtils.getDistance(enemy.pos, u.pos);
        const losCheck = los.hasLineOfSight(enemy.pos, u.pos);
        return (
          u.hp > 0 &&
          u.state !== UnitState.Extracted &&
          u.state !== UnitState.Dead &&
          d <= 12 &&
          losCheck
        );
      });

      let minDistance = Infinity;

      for (const u of visibleSoldiers) {
        const dist = MathUtils.getDistance(enemy.pos, u.pos);
        if (dist < minDistance) {
          minDistance = dist;
          targetSoldier = u;
        }
      }

      if (targetSoldier) {
        enemy.forcedTargetId = targetSoldier.id;
        enemy.targetLockUntil = state.t + AI.TARGET_LOCK_DURATION;
      } else {
        enemy.forcedTargetId = undefined;
        enemy.targetLockUntil = undefined;
      }
    }

    if (targetSoldier) {
      const dist = MathUtils.getDistance(enemy.pos, targetSoldier.pos);
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
          targetSoldier.pos,
          grid,
          pathfinder,
        );
        if (fleeTarget) {
          enemy.targetPos = fleeTarget;
          const path = pathfinder.findPath(
            MathUtils.toCellCoord(enemy.pos),
            MathUtils.toCellCoord(fleeTarget),
          );
          if (path && path.length > 0) {
            enemy.path = path;
            enemy.targetPos = { x: path[0].x + 0.5, y: path[0].y + 0.5 };
          }
        }
      } else if (dist > optimalRange) {
        // Chase
        const targetPos = targetSoldier.pos;
        const path = pathfinder.findPath(
          MathUtils.toCellCoord(enemy.pos),
          MathUtils.toCellCoord(targetPos),
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
      const currentCell = MathUtils.toCellCoord(enemy.pos);
      const roamRadius = 10;

      let attempts = 0;
      while (attempts < 5) {
        const tx = prng.nextInt(
          Math.max(0, currentCell.x - roamRadius),
          Math.min(grid.width - 1, currentCell.x + roamRadius),
        );
        const ty = prng.nextInt(
          Math.max(0, currentCell.y - roamRadius),
          Math.min(grid.height - 1, currentCell.y + roamRadius),
        );

        if (
          grid.isWalkable(tx, ty) &&
          (tx !== currentCell.x || ty !== currentCell.y)
        ) {
          const path = pathfinder.findPath(currentCell, { x: tx, y: ty });
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
    let maxDist = MathUtils.getDistance(start, threat);

    for (const c of candidates) {
      const cell = MathUtils.toCellCoord(c);
      if (grid.isWalkable(cell.x, cell.y)) {
        const dist = MathUtils.getDistance(c, threat);
        if (dist > maxDist) {
          // Ensure reachable
          const path = pathfinder.findPath(MathUtils.toCellCoord(start), cell);
          if (path) {
            maxDist = dist;
            best = { x: cell.x + 0.5, y: cell.y + 0.5 };
          }
        }
      }
    }
    return best;
  }
}
