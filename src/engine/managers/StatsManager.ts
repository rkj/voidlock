import {
  Unit,
  GameState,
  ArchetypeLibrary,
  ItemLibrary,
  WeaponLibrary,
} from "../../shared/types";

export class StatsManager {
  public recalculateStats(unit: Unit) {
    const arch = ArchetypeLibrary[unit.archetypeId];
    if (!arch) return;

    let hpBonus = 0;
    let speedBonus = 0;
    let equipmentAccuracyBonus = 0;

    const slots = [unit.body, unit.feet, unit.rightHand, unit.leftHand];
    slots.forEach((itemId) => {
      if (itemId) {
        const item = ItemLibrary[itemId];
        if (item) {
          hpBonus += item.hpBonus || 0;
          speedBonus += item.speedBonus || 0;
          equipmentAccuracyBonus += item.accuracyBonus || 0;
        }
      }
    });

    // Apply carried objective (artifact) burden
    if (unit.carriedObjectiveId) {
      // For now all carried objectives are assumed to be "artifact_heavy"
      const item = ItemLibrary["artifact_heavy"];
      if (item) {
        speedBonus += item.speedBonus || 0;
        equipmentAccuracyBonus += item.accuracyBonus || 0;
      }
    }

    unit.maxHp = arch.baseHp + hpBonus;
    unit.stats.speed = arch.speed + speedBonus;
    unit.stats.equipmentAccuracyBonus = equipmentAccuracyBonus;

    // Update weapon-dependent stats
    const weaponId = unit.activeWeaponId || unit.rightHand || "";
    const weapon = WeaponLibrary[weaponId];
    if (weapon) {
      unit.stats.damage = weapon.damage;
      unit.stats.attackRange = weapon.range;
      unit.stats.accuracy =
        unit.stats.soldierAim +
        (weapon.accuracy || 0) +
        unit.stats.equipmentAccuracyBonus;
      unit.stats.fireRate =
        weapon.fireRate * (unit.stats.speed > 0 ? 10 / unit.stats.speed : 1);
    } else {
      unit.stats.damage = arch.damage;
      unit.stats.attackRange = arch.attackRange;
      unit.stats.accuracy = unit.stats.soldierAim + equipmentAccuracyBonus;
      unit.stats.fireRate = arch.fireRate;
    }
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
      this.recalculateStats(unit);
    }
  }

  private getDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
