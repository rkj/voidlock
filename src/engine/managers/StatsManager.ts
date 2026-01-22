import {
  Unit,
  GameState,
  ArchetypeLibrary,
  ItemLibrary,
  WeaponLibrary,
} from "../../shared/types";
import { SPEED_NORMALIZATION_CONST } from "../Constants";

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
        weapon.fireRate *
        (unit.stats.speed > 0
          ? SPEED_NORMALIZATION_CONST / unit.stats.speed
          : 1);
    } else {
      unit.stats.damage = arch.damage;
      unit.stats.attackRange = arch.attackRange;
      unit.stats.accuracy = unit.stats.soldierAim + equipmentAccuracyBonus;
      unit.stats.fireRate = arch.fireRate;
    }
  }
}
