import {
  ArchetypeLibrary,
  ItemLibrary,
  WeaponLibrary,
  SquadSoldierConfig,
} from "../types";
import { CampaignSoldier } from "../campaign_types";
import { SPEED_NORMALIZATION_CONST } from "../constants";

/**
 * Shared utility for calculating effective soldier stats including equipment bonuses.
 */
export class UnitUtils {
  /**
   * Calculates the effective stats for a soldier based on their archetype and equipment.
   */
  public static calculateEffectiveStats(
    soldier: CampaignSoldier | SquadSoldierConfig,
    speedNormalization: number = SPEED_NORMALIZATION_CONST
  ) {
    const arch = ArchetypeLibrary[soldier.archetypeId];
    if (!arch) {
      return {
        maxHp: 0,
        speed: 0,
        accuracy: 0,
        damage: 0,
        fireRate: 0,
        attackRange: 0,
        fireRateDisplay: "0",
      };
    }

    let maxHp = arch.baseHp;
    let speed = arch.speed;
    let accuracy = arch.soldierAim;

    // Use current soldier values if they exist (for levels/campaign)
    if ("maxHp" in soldier && soldier.maxHp !== undefined) {
      maxHp = soldier.maxHp;
    }
    if ("soldierAim" in soldier && soldier.soldierAim !== undefined) {
      accuracy = soldier.soldierAim;
    }

    // Apply equipment bonuses
    const equipment = this.getEquipment(soldier);
    const slots = [
      equipment.body,
      equipment.feet,
      equipment.rightHand,
      equipment.leftHand,
    ];

    slots.forEach((id) => {
      if (!id) return;
      const item = ItemLibrary[id];
      if (item) {
        if (item.hpBonus) maxHp += item.hpBonus;
        if (item.speedBonus) speed += item.speedBonus;
        if (item.accuracyBonus) accuracy += item.accuracyBonus;
      }
    });

    // Default weapon stats from archetype or right hand
    const weaponId = equipment.rightHand || "";
    const weapon = WeaponLibrary[weaponId];

    let damage = arch.damage;
    let attackRange = arch.attackRange;
    let fireRate = arch.fireRate;
    let weaponAccuracy = 0;

    if (weapon) {
      damage = weapon.damage;
      attackRange = weapon.range;
      fireRate = weapon.fireRate;
      weaponAccuracy = weapon.accuracy || 0;
    }

    // Calculate effective fire rate based on speed
    const effectiveFireRate =
      fireRate * (speed > 0 ? speedNormalization / speed : 1);
    const fireRateDisplay =
      effectiveFireRate > 0 ? (1000 / effectiveFireRate).toFixed(1) : "0";

    return {
      maxHp,
      speed,
      accuracy: accuracy + weaponAccuracy,
      damage,
      fireRate: effectiveFireRate,
      attackRange,
      fireRateDisplay,
    };
  }

  private static getEquipment(
    soldier: CampaignSoldier | SquadSoldierConfig
  ): any {
    if ("equipment" in soldier) {
      return (soldier as CampaignSoldier).equipment;
    }
    return {
      rightHand: (soldier as SquadSoldierConfig).rightHand,
      leftHand: (soldier as SquadSoldierConfig).leftHand,
      body: (soldier as SquadSoldierConfig).body,
      feet: (soldier as SquadSoldierConfig).feet,
    };
  }
}
