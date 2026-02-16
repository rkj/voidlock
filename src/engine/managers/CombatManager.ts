import {
  GameState,
  Unit,
  UnitState,
  Enemy,
  WeaponLibrary,
  Attacker,
} from "../../shared/types";
import { LineOfSight } from "../LineOfSight";
import { PRNG } from "../../shared/PRNG";
import { StatsManager } from "./StatsManager";
import { isCellVisible } from "../../shared/VisibilityUtils";
import { MathUtils } from "../../shared/utils/MathUtils";
import { COMBAT } from "../config/GameConstants";

export class CombatManager {
  constructor(
    private los: LineOfSight,
    private statsManager: StatsManager,
  ) {}

  /**
   * Updates combat logic for a single unit. Handles target selection,
   * weapon switching, and attack execution.
   * @returns An object containing the updated unit and whether it is currently attacking.
   */
  public update(
    unit: Unit,
    state: GameState,
    prng: PRNG,
  ): { unit: Unit; isAttacking: boolean } {
    if (unit.state === UnitState.Extracted || unit.hp <= 0) {
      return { unit, isAttacking: false };
    }

    // 1. Preparation: ensure the correct weapon/stats are active
    let currentUnit = this.updateActiveWeapon(unit, state);

    // 2. Identification: All visible enemies in range
    const visibleEnemiesInRange = state.enemies.filter((enemy) => {
      if (enemy.hp <= 0) return false;
      const distance = MathUtils.getDistance(currentUnit.pos, enemy.pos);
      if (distance > currentUnit.stats.attackRange + COMBAT.RANGED_RANGE_BUFFER)
        return false;
      const cell = MathUtils.toCellCoord(enemy.pos);
      return isCellVisible(state, cell.x, cell.y);
    });

    const enemiesInSameCell = state.enemies.filter(
      (enemy) => enemy.hp > 0 && MathUtils.sameCellPosition(enemy.pos, currentUnit.pos),
    );
    const isLockedInMelee = enemiesInSameCell.length > 0;

    // 3. Stickiness: Check if current forcedTarget is still valid
    let targetEnemy: Enemy | undefined;
    if (currentUnit.forcedTargetId) {
      const sticky = visibleEnemiesInRange.find(
        (e) => e.id === currentUnit.forcedTargetId,
      );
      // Valid if: alive, in range, and HAS LINE OF FIRE
      if (sticky && this.los.hasLineOfFire(currentUnit.pos, sticky.pos)) {
        targetEnemy = sticky;
      } else {
        currentUnit = { ...currentUnit, forcedTargetId: undefined };
      }
    }

    // 4. New Target Acquisition (if no sticky target)
    if (!targetEnemy && visibleEnemiesInRange.length > 0) {
      let bestScore = -1;
      let bestTarget: Enemy | undefined;

      for (const enemy of visibleEnemiesInRange) {
        if (this.los.hasLineOfFire(currentUnit.pos, enemy.pos)) {
          const distance = MathUtils.getDistance(currentUnit.pos, enemy.pos);
          // Score = (MaxHP - CurrentHP) + (100 / Distance)
          const score =
            enemy.maxHp -
            enemy.hp +
            COMBAT.STICKY_TARGET_SCORE_NORM /
              Math.max(COMBAT.MIN_DISTANCE, distance);

          if (score > bestScore) {
            bestScore = score;
            bestTarget = enemy;
          } else if (score === bestScore && bestTarget) {
            // Tie-breaker: Closest
            const bestDist = MathUtils.getDistance(
              currentUnit.pos,
              bestTarget.pos,
            );
            if (distance < bestDist) {
              bestTarget = enemy;
            }
          }
        }
      }

      if (bestTarget) {
        targetEnemy = bestTarget;
        currentUnit = { ...currentUnit, forcedTargetId: bestTarget.id };
      }
    }

    const policy = currentUnit.engagementPolicy || "ENGAGE";

    if (
      currentUnit.archetypeId !== "vip" &&
      targetEnemy &&
      (policy === "ENGAGE" || isLockedInMelee)
    ) {
      if (this.los.hasLineOfFire(currentUnit.pos, targetEnemy.pos)) {
        // We still let handleAttack mutate for now, but we update the attacker's state
        const attacked = this.handleAttack(
          currentUnit,
          targetEnemy,
          {
            damage: currentUnit.stats.damage,
            fireRate: currentUnit.stats.fireRate,
            accuracy: currentUnit.stats.accuracy,
            attackRange: currentUnit.stats.attackRange,
          },
          state,
          prng,
          () => {
            // This callback mutates currentUnit, which is tricky.
            // But since handleAttack is called with currentUnit, we can update it after.
          },
        );

        if (attacked) {
          // Re-clone to reflect changes from handleAttack (like lastAttackTime)
          // Since handleAttack is called with currentUnit, we have to be careful.
          // To be truly immutable, handleAttack should return new objects.
          if (targetEnemy.hp <= 0) {
            currentUnit = {
              ...currentUnit,
              kills: currentUnit.kills + 1,
              forcedTargetId: undefined,
              state: UnitState.Attacking,
            };
          } else {
            currentUnit = { ...currentUnit, state: UnitState.Attacking };
          }
          return { unit: currentUnit, isAttacking: true };
        } else {
          // Engaged but on cooldown - still counts as attacking to prevent stutter-step
          currentUnit = { ...currentUnit, state: UnitState.Attacking };
          return { unit: currentUnit, isAttacking: true };
        }
      }
    }

    return { unit: currentUnit, isAttacking: false };
  }

  /**
   * Universal attack handler for both Units and Enemies.
   * Updates health, lastAttack fields and emits AttackEvents.
   * @returns True if the attack was executed (cooldown and LOS check passed).
   */
  public handleAttack(
    attacker: Attacker,
    target: Unit | Enemy,
    stats: {
      damage: number;
      fireRate: number;
      accuracy: number;
      attackRange: number;
    },
    state: GameState,
    prng: PRNG,
    onKilled?: () => void,
  ): boolean {
    if ((attacker.hp !== undefined && attacker.hp <= 0) || target.hp <= 0) {
      return false;
    }

    if (
      attacker.lastAttackTime === undefined ||
      state.t - attacker.lastAttackTime >= stats.fireRate
    ) {
      if (this.los.hasLineOfFire(attacker.pos, target.pos)) {
        const distance = MathUtils.getDistance(attacker.pos, target.pos);
        const S = stats.accuracy;
        const R = stats.attackRange;
        let hitChance =
          (S / COMBAT.HIT_CHANCE_NORM) *
          (R / Math.max(COMBAT.MIN_DISTANCE, distance));
        hitChance = Math.max(
          COMBAT.MIN_HIT_CHANCE,
          Math.min(COMBAT.MAX_HIT_CHANCE, hitChance),
        );

        if (prng.next() <= hitChance) {
          target.hp -= stats.damage;
          if (target.hp <= 0 && onKilled) {
            onKilled();
          }
        }

        // Maintain steady cadence by adding fireRate to lastAttackTime
        // If it's the first shot, we set it such that next shot is due in fireRate ms
        if (attacker.lastAttackTime === undefined) {
          attacker.lastAttackTime = state.t;
        } else {
          attacker.lastAttackTime += stats.fireRate;
          // Safeguard: if we are too far behind (e.g. after a long pause or lag),
          // reset to current t to avoid "machine gun" catch-up.
          if (state.t - attacker.lastAttackTime > stats.fireRate * 2) {
            attacker.lastAttackTime = state.t;
          }
        }
        attacker.lastAttackTarget = { ...target.pos };

        // Emit Attack Event for feedback systems
        if (!state.attackEvents) state.attackEvents = [];
        state.attackEvents = [
          ...state.attackEvents,
          {
            attackerId: attacker.id,
            attackerPos: { ...attacker.pos },
            targetId: target.id,
            targetPos: { ...target.pos },
            time: state.t,
          },
        ];

        return true;
      }
    }
    return false;
  }

  /**
   * Automatically switches the unit's active weapon based on the distance to visible enemies.
   * Prioritizes melee weapons for adjacent enemies and ranged weapons for others.
   * @returns A new unit reference if the active weapon was changed, otherwise the original unit.
   */
  public updateActiveWeapon(unit: Unit, state: GameState): Unit {
    if (!unit.rightHand && !unit.leftHand) return unit;

    const visibleEnemies = state.enemies.filter((enemy) => {
      if (enemy.hp <= 0) return false;
      const cell = MathUtils.toCellCoord(enemy.pos);
      return isCellVisible(state, cell.x, cell.y);
    });

    const rightWeapon = unit.rightHand
      ? WeaponLibrary[unit.rightHand]
      : undefined;
    const leftWeapon = unit.leftHand ? WeaponLibrary[unit.leftHand] : undefined;

    if (!rightWeapon && !leftWeapon) return unit;

    let targetWeaponId = unit.activeWeaponId || unit.rightHand || unit.leftHand;

    const enemiesInMelee = visibleEnemies.filter((e) => {
      const meleeRange =
        (leftWeapon?.type === "Melee" ? leftWeapon.range : 1) +
        COMBAT.MELEE_RANGE_BUFFER;
      return MathUtils.getDistance(unit.pos, e.pos) <= meleeRange;
    });

    if (enemiesInMelee.length > 0 && leftWeapon?.type === "Melee") {
      targetWeaponId = unit.leftHand;
    } else if (rightWeapon) {
      const enemiesInRanged = visibleEnemies.filter(
        (e) =>
          MathUtils.getDistance(unit.pos, e.pos) <=
          rightWeapon.range + COMBAT.RANGED_RANGE_BUFFER,
      );
      if (enemiesInRanged.length > 0) {
        targetWeaponId = unit.rightHand;
      }
    }

    if (targetWeaponId && unit.activeWeaponId !== targetWeaponId) {
      const updatedUnit = { ...unit, activeWeaponId: targetWeaponId };
      return this.statsManager.recalculateStats(updatedUnit);
    }

    return unit;
  }
}
