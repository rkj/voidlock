import type {
  GameState,
  Unit,
  Enemy,
  Attacker} from "../../shared/types";
import {
  UnitState,
  CommandType,
  WeaponLibrary
} from "../../shared/types";
import type { LineOfSight } from "../LineOfSight";
import type { PRNG } from "../../shared/PRNG";
import type { StatsManager } from "./StatsManager";
import { isCellVisible } from "../../shared/VisibilityUtils";
import { MathUtils } from "../../shared/utils/MathUtils";
import { COMBAT } from "../config/GameConstants";

export interface HandleAttackParams {
  attacker: Attacker;
  target: Unit | Enemy;
  stats: {
    damage: number;
    fireRate: number;
    accuracy: number;
    attackRange: number;
  };
  state: GameState;
  prng: PRNG;
  onKilled?: () => void;
}

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
    if (unit.state === UnitState.Extracted || unit.hp <= 0 || unit.state === UnitState.Channeling) {
      return { unit, isAttacking: false };
    }

    // 1. Preparation: ensure the correct weapon/stats are active
    let currentUnit = this.updateActiveWeapon(unit, state);

    // 2. Identification: All visible enemies in range
    const visibleEnemiesInRange = this.getVisibleEnemiesInRange(currentUnit, state);

    const enemiesInSameCell = state.enemies.filter(
      (enemy) => enemy.hp > 0 && MathUtils.sameCellPosition(enemy.pos, currentUnit.pos),
    );
    const isLockedInMelee = enemiesInSameCell.length > 0;

    // 3. Stickiness: Check if current forcedTarget is still valid
    let targetEnemy: Enemy | undefined;
    const stickyResult = this.resolveStickyTarget(currentUnit, visibleEnemiesInRange);
    currentUnit = stickyResult.unit;
    targetEnemy = stickyResult.target;

    // 4. New Target Acquisition (if no sticky target)
    if (!targetEnemy && visibleEnemiesInRange.length > 0) {
      const acquired = this.acquireTarget(currentUnit, visibleEnemiesInRange);
      if (acquired) {
        targetEnemy = acquired;
        currentUnit = { ...currentUnit, forcedTargetId: acquired.id };
      }
    }

    const policy = currentUnit.engagementPolicy || "ENGAGE";

    const isExtracting = currentUnit.activeCommand?.type === CommandType.EXTRACT ||
                        currentUnit.activeCommand?.label === "Extracting";

    if (
      currentUnit.archetypeId !== "vip" &&
      targetEnemy &&
      !isExtracting &&
      (policy === "ENGAGE" || isLockedInMelee || policy === "AVOID" || policy === "IGNORE")
    ) {
      if (this.los.hasLineOfFire(currentUnit.pos, targetEnemy.pos)) {
        return this.executeAttack(currentUnit, targetEnemy, state, prng);
      }
    }

    return { unit: currentUnit, isAttacking: false };
  }

  private getVisibleEnemiesInRange(unit: Unit, state: GameState): Enemy[] {
    return state.enemies.filter((enemy) => {
      if (enemy.hp <= 0) return false;
      const distance = MathUtils.getDistance(unit.pos, enemy.pos);
      if (distance > unit.stats.attackRange + COMBAT.RANGED_RANGE_BUFFER)
        return false;
      const cell = MathUtils.toCellCoord(enemy.pos);
      return isCellVisible(state, cell.x, cell.y);
    });
  }

  private resolveStickyTarget(
    unit: Unit,
    visibleEnemiesInRange: Enemy[],
  ): { unit: Unit; target: Enemy | undefined } {
    if (!unit.forcedTargetId) return { unit, target: undefined };

    const sticky = visibleEnemiesInRange.find((e) => e.id === unit.forcedTargetId);
    if (sticky && this.los.hasLineOfFire(unit.pos, sticky.pos)) {
      return { unit, target: sticky };
    }
    return { unit: { ...unit, forcedTargetId: undefined }, target: undefined };
  }

  private acquireTarget(unit: Unit, visibleEnemiesInRange: Enemy[]): Enemy | undefined {
    let bestScore = -1;
    let bestTarget: Enemy | undefined;

    for (const enemy of visibleEnemiesInRange) {
      if (!this.los.hasLineOfFire(unit.pos, enemy.pos)) continue;

      const distance = MathUtils.getDistance(unit.pos, enemy.pos);
      const score =
        enemy.maxHp -
        enemy.hp +
        COMBAT.STICKY_TARGET_SCORE_NORM / Math.max(COMBAT.MIN_DISTANCE, distance);

      if (score > bestScore) {
        bestScore = score;
        bestTarget = enemy;
      } else if (score === bestScore && bestTarget) {
        const bestDist = MathUtils.getDistance(unit.pos, bestTarget.pos);
        if (distance < bestDist) {
          bestTarget = enemy;
        }
      }
    }

    return bestTarget;
  }

  private executeAttack(
    unit: Unit,
    targetEnemy: Enemy,
    state: GameState,
    prng: PRNG,
  ): { unit: Unit; isAttacking: boolean } {
    const attacked = this.handleAttack({
      attacker: unit,
      target: targetEnemy,
      stats: {
        damage: unit.stats.damage,
        fireRate: unit.stats.fireRate,
        accuracy: unit.stats.accuracy,
        attackRange: unit.stats.attackRange,
      },
      state,
      prng,
    });

    if (attacked) {
      if (targetEnemy.hp <= 0) {
        return {
          unit: {
            ...unit,
            kills: unit.kills + 1,
            forcedTargetId: undefined,
            state: UnitState.Attacking,
          },
          isAttacking: true,
        };
      }
      return { unit: { ...unit, state: UnitState.Attacking }, isAttacking: true };
    }
    // Engaged but on cooldown - still counts as attacking to prevent stutter-step
    return { unit: { ...unit, state: UnitState.Attacking }, isAttacking: true };
  }

  /**
   * Universal attack handler for both Units and Enemies.
   * Updates health, lastAttack fields and emits AttackEvents.
   * @returns True if the attack was executed (cooldown and LOS check passed).
   */
  public handleAttack(params: HandleAttackParams): boolean {
    const { attacker, target, stats, state, prng, onKilled } = params;
    if ((attacker.hp !== undefined && attacker.hp <= 0) || target.hp <= 0) {
      return false;
    }

    if (
      attacker.lastAttackTime === undefined ||
      state.t - attacker.lastAttackTime >= stats.fireRate
    ) {
      if (this.los.hasLineOfFire(attacker.pos, target.pos)) {
        this.performShot({ attacker, target, stats, state, prng, onKilled });
        return true;
      }
    }
    return false;
  }

  private performShot(params: HandleAttackParams): void {
    const { attacker, target, stats, state, prng, onKilled } = params;
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

    this.updateAttackTiming(attacker, stats.fireRate, state.t);
    attacker.lastAttackTarget = { ...target.pos };

    // Emit Attack Event for feedback systems
    state.attackEvents ??= [];
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
  }

  private updateAttackTiming(attacker: Attacker, fireRate: number, t: number): void {
    if (attacker.lastAttackTime === undefined) {
      attacker.lastAttackTime = t;
    } else {
      attacker.lastAttackTime += fireRate;
      // Safeguard: if we are too far behind (e.g. after a long pause or lag),
      // reset to current t to avoid "machine gun" catch-up.
      if (t - attacker.lastAttackTime > fireRate * 2) {
        attacker.lastAttackTime = t;
      }
    }
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
