import {
  GameState,
  Unit,
  UnitState,
  Enemy,
  WeaponLibrary,
  Vector2,
} from "../../shared/types";
import { LineOfSight } from "../LineOfSight";
import { PRNG } from "../../shared/PRNG";
import { StatsManager } from "./StatsManager";

export class CombatManager {
  constructor(private los: LineOfSight, private statsManager: StatsManager) {}

  public update(
    unit: Unit,
    state: GameState,
    dt: number,
    prng: PRNG,
    visibleCells: Set<string>,
  ) {
    if (unit.state === UnitState.Extracted || unit.hp <= 0) return;

    // 1. Preparation: ensure the correct weapon/stats are active
    this.updateActiveWeapon(unit, state, visibleCells);

    // 2. Identification: All visible enemies in range
    const visibleEnemiesInRange = state.enemies.filter(
      (enemy) =>
        enemy.hp > 0 &&
        this.getDistance(unit.pos, enemy.pos) <=
          unit.stats.attackRange + 0.5 &&
        visibleCells.has(
          `${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`,
        ),
    );

    const enemiesInSameCell = state.enemies.filter(
      (enemy) =>
        enemy.hp > 0 &&
        Math.floor(enemy.pos.x) === Math.floor(unit.pos.x) &&
        Math.floor(enemy.pos.y) === Math.floor(unit.pos.y),
    );
    const isLockedInMelee = enemiesInSameCell.length > 0;

    // 3. Stickiness: Check if current forcedTarget is still valid
    let targetEnemy: Enemy | undefined;
    if (unit.forcedTargetId) {
      const sticky = visibleEnemiesInRange.find(
        (e) => e.id === unit.forcedTargetId,
      );
      // Valid if: alive, in range, and HAS LINE OF FIRE
      if (sticky && this.los.hasLineOfFire(unit.pos, sticky.pos)) {
        targetEnemy = sticky;
      } else {
        unit.forcedTargetId = undefined;
      }
    }

    // 4. New Target Acquisition (if no sticky target)
    if (!targetEnemy && visibleEnemiesInRange.length > 0) {
      let bestScore = -1;
      let bestTarget: Enemy | undefined;

      for (const enemy of visibleEnemiesInRange) {
        if (this.los.hasLineOfFire(unit.pos, enemy.pos)) {
          const distance = this.getDistance(unit.pos, enemy.pos);
          // Score = (MaxHP - CurrentHP) + (100 / Distance)
          const score =
            enemy.maxHp - enemy.hp + 100 / Math.max(0.1, distance);

          if (score > bestScore) {
            bestScore = score;
            bestTarget = enemy;
          } else if (score === bestScore && bestTarget) {
            // Tie-breaker: Closest
            const bestDist = this.getDistance(unit.pos, bestTarget.pos);
            if (distance < bestDist) {
              bestTarget = enemy;
            }
          }
        }
      }

      if (bestTarget) {
        targetEnemy = bestTarget;
        unit.forcedTargetId = bestTarget.id;
      }
    }

    const policy = unit.engagementPolicy || "ENGAGE";

    if (
      unit.archetypeId !== "vip" &&
      targetEnemy &&
      (policy === "ENGAGE" || isLockedInMelee)
    ) {
      if (this.los.hasLineOfFire(unit.pos, targetEnemy.pos)) {
        if (
          !unit.lastAttackTime ||
          state.t - unit.lastAttackTime >= unit.stats.fireRate
        ) {
          const distance = this.getDistance(unit.pos, targetEnemy.pos);
          const S = unit.stats.accuracy;
          const R = unit.stats.attackRange;
          let hitChance = (S / 100) * (R / Math.max(0.1, distance));
          hitChance = Math.max(0, Math.min(1.0, hitChance));

          if (prng.next() <= hitChance) {
            targetEnemy.hp -= unit.stats.damage;
            if (targetEnemy.hp <= 0) {
              unit.kills++;
              unit.forcedTargetId = undefined; // Clear sticky target on death
            }
          }

          unit.lastAttackTime = state.t;
          unit.lastAttackTarget = { ...targetEnemy.pos };
        }

        unit.state = UnitState.Attacking;
        return true; // isAttacking
      }
    }

    return false; // isAttacking
  }

  public updateActiveWeapon(
    unit: Unit,
    state: GameState,
    visibleCells: Set<string>,
  ) {
    if (!unit.rightHand && !unit.leftHand) return;

    const visibleEnemies = state.enemies.filter(
      (enemy) =>
        enemy.hp > 0 &&
        visibleCells.has(
          `${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`,
        ),
    );

    const rightWeapon = unit.rightHand
      ? WeaponLibrary[unit.rightHand]
      : undefined;
    const leftWeapon = unit.leftHand ? WeaponLibrary[unit.leftHand] : undefined;

    if (!rightWeapon && !leftWeapon) return;

    let targetWeaponId = unit.activeWeaponId || unit.rightHand || unit.leftHand;

    const enemiesInMelee = visibleEnemies.filter((e) => {
      const meleeRange =
        (leftWeapon?.type === "Melee" ? leftWeapon.range : 1) + 0.05;
      return this.getDistance(unit.pos, e.pos) <= meleeRange;
    });

    if (enemiesInMelee.length > 0 && leftWeapon?.type === "Melee") {
      targetWeaponId = unit.leftHand;
    } else if (rightWeapon) {
      const enemiesInRanged = visibleEnemies.filter(
        (e) => this.getDistance(unit.pos, e.pos) <= rightWeapon.range + 0.5,
      );
      if (enemiesInRanged.length > 0) {
        targetWeaponId = unit.rightHand;
      }
    }

    if (targetWeaponId && unit.activeWeaponId !== targetWeaponId) {
      unit.activeWeaponId = targetWeaponId;
      this.statsManager.recalculateStats(unit);
    }
  }

  private getDistance(pos1: Vector2, pos2: Vector2): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
