import { GameState, Enemy, Unit, UnitState, Grid } from "../../shared/types";
import { Pathfinder } from "../Pathfinder";
import { PRNG } from "../../shared/PRNG";
import { LineOfSight } from "../LineOfSight";
import { MathUtils } from "../../shared/utils/MathUtils";
import { AI } from "../config/GameConstants";

export interface IEnemyAI {
  think(
    enemy: Enemy,
    state: GameState,
    grid: Grid,
    pathfinder: Pathfinder,
    los: LineOfSight,
    prng: PRNG,
  ): void;
}

export class SwarmMeleeAI implements IEnemyAI {
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
          MathUtils.getDistance(enemy.pos, sticky.pos) <= 12 &&
          los.hasLineOfSight(enemy.pos, sticky.pos)
        ) {
          targetSoldier = sticky;
        }
      }
    }

    // 2. Detection: Find closest visible soldier (if no sticky target)
    if (!targetSoldier) {
      const visibleSoldiers = state.units.filter(
        (u) =>
          u.hp > 0 &&
          u.state !== UnitState.Extracted &&
          u.state !== UnitState.Dead &&
          MathUtils.getDistance(enemy.pos, u.pos) <= 10 && // Detection radius
          los.hasLineOfSight(enemy.pos, u.pos),
      );

      let minDistance = Infinity;

      visibleSoldiers.forEach((u) => {
        const dist = MathUtils.getDistance(enemy.pos, u.pos);
        if (dist < minDistance) {
          minDistance = dist;
          targetSoldier = u;
        }
      });

      if (targetSoldier) {
        enemy.forcedTargetId = targetSoldier.id;
        enemy.targetLockUntil = state.t + AI.TARGET_LOCK_DURATION;
      } else {
        enemy.forcedTargetId = undefined;
        enemy.targetLockUntil = undefined;
      }
    }

    if (targetSoldier) {
      // 3. Attack Mode: Pathfind to soldier
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
      // 4. Roam Mode: If idle and no target, pick a random distant cell
      if ((!enemy.path || enemy.path.length === 0) && !enemy.targetPos) {
        const currentX = Math.floor(enemy.pos.x);
        const currentY = Math.floor(enemy.pos.y);
        const roamRadius = 10;

        // Try to find a valid distant target
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
  }
}