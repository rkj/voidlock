import { CampaignSoldier } from "../../shared/campaign_types";
import { ArchetypeLibrary } from "../../shared/types";
import { PRNG } from "../../shared/PRNG";
import { RosterUtils } from "./RosterUtils";

/**
 * Factory for creating campaign soldiers.
 */
export class SoldierFactory {
  /**
   * Creates a new campaign soldier from an archetype.
   * @param archetypeId ID of the archetype to use.
   * @param existingRoster Optional existing roster to avoid duplicate names and help with ID generation.
   * @param options Optional configuration for the new soldier.
   */
  public static createSoldier(
    archetypeId: string,
    existingRoster: CampaignSoldier[] = [],
    options: {
      id?: string;
      name?: string;
      prng?: PRNG;
    } = {},
  ): CampaignSoldier {
    const arch = ArchetypeLibrary[archetypeId];
    if (!arch) {
      throw new Error(`Invalid archetype ID: ${archetypeId}`);
    }

    const prng = options.prng;
    const finalId =
      options.id ||
      `soldier_${Date.now()}_${Math.floor(
        prng ? prng.next() * 1000 : Math.random() * 1000,
      )}`;
    const finalName =
      options.name || RosterUtils.getRandomName(existingRoster, prng);

    return {
      id: finalId,
      name: finalName,
      archetypeId,
      hp: arch.baseHp,
      maxHp: arch.baseHp,
      soldierAim: arch.soldierAim,
      xp: 0,
      level: 1,
      kills: 0,
      missions: 0,
      status: "Healthy",
      recoveryTime: 0,
      equipment: {
        rightHand: arch.rightHand,
        leftHand: arch.leftHand,
        body: arch.body,
        feet: arch.feet,
      },
    };
  }
}
