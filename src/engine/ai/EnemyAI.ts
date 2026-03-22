import type { GameState, Enemy, Unit, Grid } from "../../shared/types";
import { UnitState } from "../../shared/types";
import type { Pathfinder } from "../Pathfinder";
import type { PRNG } from "../../shared/PRNG";
import type { LineOfSight } from "../LineOfSight";
import { MathUtils } from "../../shared/utils/MathUtils";
import { AI } from "../config/GameConstants";

export interface ThinkParams {
  enemy: Enemy;
  state: GameState;
  grid: Grid;
  pathfinder: Pathfinder;
  los: LineOfSight;
  prng: PRNG;
}

export interface IEnemyAI {
  think(params: ThinkParams): void;
}

export class SwarmMeleeAI implements IEnemyAI {
  private resolveStickyTarget(enemy: Enemy, state: GameState, los: LineOfSight): Unit | null {
    if (!enemy.forcedTargetId || !enemy.targetLockUntil || state.t >= enemy.targetLockUntil) {
      return null;
    }
    const sticky = state.units.find((u) => u.id === enemy.forcedTargetId);
    if (!sticky || sticky.hp <= 0 || sticky.state === UnitState.Extracted || sticky.state === UnitState.Dead) {
      return null;
    }
    if (MathUtils.getDistance(enemy.pos, sticky.pos) <= 12 && los.hasLineOfSight(enemy.pos, sticky.pos)) {
      return sticky;
    }
    return null;
  }

  private detectTarget(enemy: Enemy, state: GameState, los: LineOfSight): Unit | null {
    const visibleSoldiers = state.units.filter(
      (u) =>
        u.hp > 0 &&
        u.state !== UnitState.Extracted &&
        u.state !== UnitState.Dead &&
        MathUtils.getDistance(enemy.pos, u.pos) <= 10 &&
        los.hasLineOfSight(enemy.pos, u.pos),
    );

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

  private handleAttackMode(enemy: Enemy, target: Unit, pathfinder: Pathfinder): void {
    const targetPos = target.pos;
    const path = pathfinder.findPath(
      { x: Math.floor(enemy.pos.x), y: Math.floor(enemy.pos.y) },
      { x: Math.floor(targetPos.x), y: Math.floor(targetPos.y) },
    );
    if (path && path.length > 0) {
      enemy.path = path;
      enemy.targetPos = MathUtils.getCellCenter(path[0], enemy.visualJitter);
    }
  }

  private handleRoamMode(enemy: Enemy, grid: Grid, pathfinder: Pathfinder, prng: PRNG): void {
    if ((enemy.path && enemy.path.length > 0) || enemy.targetPos) return;
    const currentX = Math.floor(enemy.pos.x);
    const currentY = Math.floor(enemy.pos.y);
    const roamRadius = 10;
    let attempts = 0;
    while (attempts < 5) {
      const tx = prng.nextInt(Math.max(0, currentX - roamRadius), Math.min(grid.width - 1, currentX + roamRadius));
      const ty = prng.nextInt(Math.max(0, currentY - roamRadius), Math.min(grid.height - 1, currentY + roamRadius));
      if (grid.isWalkable(tx, ty) && (tx !== currentX || ty !== currentY)) {
        const path = pathfinder.findPath({ x: currentX, y: currentY }, { x: tx, y: ty });
        if (path && path.length > 0) {
          enemy.path = path;
          enemy.targetPos = MathUtils.getCellCenter(path[0], enemy.visualJitter);
          break;
        }
      }
      attempts++;
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
      this.handleAttackMode(enemy, targetSoldier, pathfinder);
    } else {
      this.handleRoamMode(enemy, grid, pathfinder, prng);
    }
  }
}
