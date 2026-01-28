import {
  Unit,
  ArchetypeLibrary,
  ItemLibrary,
  WeaponLibrary,
} from "../../shared/types";
import { SPEED_NORMALIZATION_CONST } from "../config/GameConstants";

export class StatsManager {
  public recalculateStats(unit: Unit): Unit {
    const arch = ArchetypeLibrary[unit.archetypeId];
    if (!arch) return unit;

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

    const nextStats = {
      ...unit.stats,
      speed: arch.speed + speedBonus,
      equipmentAccuracyBonus: equipmentAccuracyBonus,
    };

    // Update weapon-dependent stats
    const weaponId = unit.activeWeaponId || unit.rightHand || "";
    const weapon = WeaponLibrary[weaponId];
    if (weapon) {
      nextStats.damage = weapon.damage;
      nextStats.attackRange = weapon.range;
      nextStats.accuracy =
        nextStats.soldierAim +
        (weapon.accuracy || 0) +
        nextStats.equipmentAccuracyBonus;
      nextStats.fireRate =
        weapon.fireRate *
        (nextStats.speed > 0
          ? SPEED_NORMALIZATION_CONST / nextStats.speed
          : 1);
    } else {
      nextStats.damage = arch.damage;
      nextStats.attackRange = arch.attackRange;
      nextStats.accuracy = nextStats.soldierAim + equipmentAccuracyBonus;
      nextStats.fireRate = arch.fireRate;
    }

    const nextMaxHp = arch.baseHp + hpBonus;

    // Check if anything actually changed
    if (
      unit.maxHp === nextMaxHp &&
      JSON.stringify(unit.stats) === JSON.stringify(nextStats)
    ) {
      return unit;
    }

    return {
      ...unit,
      maxHp: nextMaxHp,
      stats: nextStats,
    };
  }
}
