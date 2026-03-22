import type {
  Enemy,
  Unit,
  Vector2,
  Grid,
  GameState} from "../../shared/types";
import {
  UnitState
} from "../../shared/types";
import type { Pathfinder } from "../Pathfinder";
import type { PRNG } from "../../shared/PRNG";
import type { IEnemyAI, ThinkParams } from "./EnemyAI";
import type { LineOfSight } from "../LineOfSight";
import { MathUtils } from "../../shared/utils/MathUtils";
import { AI } from "../config/GameConstants";

export class RangedKiteAI implements IEnemyAI {
  private resolveStickyTarget(enemy: Enemy, state: GameState, los: LineOfSight): Unit | null {
    if (!enemy.forcedTargetId || !enemy.targetLockUntil || state.t >= enemy.targetLockUntil) {
      return null;
    }
    const sticky = state.units.find((u) => u.id === enemy.forcedTargetId);
    if (!sticky || sticky.hp <= 0 || sticky.state === UnitState.Extracted || sticky.state === UnitState.Dead) {
      return null;
    }
    if (MathUtils.getDistance(enemy.pos, sticky.pos) <= 15 && los.hasLineOfSight(enemy.pos, sticky.pos)) {
      return sticky;
    }
    return null;
  }

  private detectTarget(enemy: Enemy, state: GameState, los: LineOfSight): Unit | null {
    const visibleSoldiers = state.units.filter((u) => {
      const d = MathUtils.getDistance(enemy.pos, u.pos);
      return (
        u.hp > 0 &&
        u.state !== UnitState.Extracted &&
        u.state !== UnitState.Dead &&
        d <= 12 &&
        los.hasLineOfSight(enemy.pos, u.pos)
      );
    });

    let minDistance = Infinity;
    let targetSoldier: Unit | null = null;
    for (const u of visibleSoldiers) {
      const dist = MathUtils.getDistance(enemy.pos, u.pos);
      if (dist < minDistance) {
        minDistance = dist;
        targetSoldier = u;
      }
    }
    return targetSoldier;
  }

  private handleEngageTarget(enemy: Enemy, target: Unit, grid: Grid, pathfinder: Pathfinder): void {
    const dist = MathUtils.getDistance(enemy.pos, target.pos);
    const optimalRange = enemy.attackRange - 1;
    const fleeThreshold = 3;

    if (dist < fleeThreshold) {
      const fleeTarget = this.findFleeTarget(enemy, target.pos, grid, pathfinder);
      if (fleeTarget) {
        enemy.targetPos = fleeTarget;
        const path = pathfinder.findPath(MathUtils.toCellCoord(enemy.pos), MathUtils.toCellCoord(fleeTarget));
        if (path && path.length > 0) {
          enemy.path = path;
          enemy.targetPos = MathUtils.getCellCenter(path[0], enemy.visualJitter);
        }
      }
    } else if (dist > optimalRange) {
      const path = pathfinder.findPath(MathUtils.toCellCoord(enemy.pos), MathUtils.toCellCoord(target.pos));
      if (path && path.length > 0) {
        enemy.path = path;
        enemy.targetPos = MathUtils.getCellCenter(path[0], enemy.visualJitter);
      }
    } else {
      enemy.path = [];
      enemy.targetPos = undefined;
    }
  }

  think({ enemy, state, grid, pathfinder, los, prng }: ThinkParams): void {
    if (enemy.hp <= 0) return;

    let targetSoldier = this.resolveStickyTarget(enemy, state, los);

    if (!targetSoldier) {
      targetSoldier = this.detectTarget(enemy, state, los);
      if (targetSoldier) {
        enemy.forcedTargetId = targetSoldier.id;
        enemy.targetLockUntil = state.t + AI.TARGET_LOCK_DURATION;
      } else {
        enemy.forcedTargetId = undefined;
        enemy.targetLockUntil = undefined;
      }
    }

    if (targetSoldier) {
      this.handleEngageTarget(enemy, targetSoldier, grid, pathfinder);
    } else {
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
            enemy.targetPos = MathUtils.getCellCenter(path[0], enemy.visualJitter);
            break;
          }
        }
        attempts++;
      }
    }
  }

  private findFleeTarget(
    enemy: Enemy,
    threat: Vector2,
    grid: Grid,
    pathfinder: Pathfinder,
  ): Vector2 | null {
    // Try random directions away from threat
    const start = enemy.pos;
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
            best = MathUtils.getCellCenter(cell, enemy.visualJitter);
          }
        }
      }
    }
    return best;
  }
}
