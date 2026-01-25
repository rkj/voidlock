import {
  GameState,
  Enemy,
  Vector2,
} from "../../shared/types";
import { LineOfSight } from "../LineOfSight";
import { PRNG } from "../../shared/PRNG";
import { CombatManager } from "./CombatManager";
import { MathUtils } from "../../shared/utils/MathUtils";

export class TurretManager {
  constructor(private los: LineOfSight) {}

  public update(
    state: GameState,
    _scaledDt: number,
    prng: PRNG,
    combatManager: CombatManager,
  ) {
    state.turrets.forEach((turret) => {
      // 1. Identification: All visible enemies in range
      // Note: Turrets are automated, they can see anything that is currently visible to the squad
      // Or maybe they have their own sight? The spec says "Automatically shoots enemies".
      // Usually turrets have their own LOS.
      const visibleEnemiesInRange = state.enemies.filter(
        (enemy) =>
          enemy.hp > 0 &&
          MathUtils.getDistance(turret.pos, enemy.pos) <= turret.attackRange + 0.5 &&
          this.los.hasLineOfFire(turret.pos, enemy.pos)
      );

      let targetEnemy: Enemy | undefined;
      if (visibleEnemiesInRange.length > 0) {
        // Target closest enemy
        let minDistance = Infinity;
        visibleEnemiesInRange.forEach((enemy) => {
          const dist = MathUtils.getDistance(turret.pos, enemy.pos);
          if (dist < minDistance) {
            minDistance = dist;
            targetEnemy = enemy;
          }
        });
      }

      if (targetEnemy) {
        combatManager.handleAttack(
          turret,
          targetEnemy,
          {
            damage: turret.damage,
            fireRate: turret.fireRate,
            accuracy: turret.accuracy,
            attackRange: turret.attackRange,
          },
          state,
          prng
        );
      }
    });
  }
}
