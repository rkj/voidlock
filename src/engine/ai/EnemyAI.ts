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
import { MathUtils } from "../../shared/utils/MathUtils";

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

    // 1. Detection: Find closest visible soldier
    const visibleSoldiers = state.units.filter(
      (u) =>
        u.hp > 0 &&
        u.state !== UnitState.Extracted &&
        u.state !== UnitState.Dead &&
        MathUtils.getDistance(enemy.pos, u.pos) <= 10 && // Detection radius
        los.hasLineOfSight(enemy.pos, u.pos),
    );

    let targetSoldier: Unit | null = null;
    let minDistance = Infinity;

    visibleSoldiers.forEach((u) => {
      const dist = MathUtils.getDistance(enemy.pos, u.pos);
      if (dist < minDistance) {
        minDistance = dist;
        targetSoldier = u;
      }
    });

    if (targetSoldier) {
      // 2. Attack Mode: Pathfind to soldier
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
      // 3. Roam Mode: If idle and no target, pick a random distant cell
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
