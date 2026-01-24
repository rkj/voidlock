import { CampaignState, CampaignSoldier } from "../../shared/campaign_types";
import { ArchetypeLibrary, EquipmentState } from "../../shared/types";

/**
 * Handles roster-related logic for the campaign.
 */
export class RosterManager {
  /**
   * Generates the initial roster of soldiers for a new campaign.
   */
  public generateInitialRoster(): CampaignSoldier[] {
    const archetypes = ["assault", "medic", "scout", "heavy"];
    const roster: CampaignSoldier[] = [];

    for (let i = 0; i < 4; i++) {
      const archId = archetypes[i % archetypes.length];
      const arch = ArchetypeLibrary[archId];
      roster.push({
        id: `soldier_${i}`,
        name: `Recruit ${i + 1}`,
        archetypeId: archId,
        hp: arch ? arch.baseHp : 100,
        maxHp: arch ? arch.baseHp : 100,
        soldierAim: arch ? arch.soldierAim : 80,
        xp: 0,
        level: 1,
        kills: 0,
        missions: 0,
        status: "Healthy",
        recoveryTime: 0,
        equipment: {
          rightHand: arch?.rightHand,
          leftHand: arch?.leftHand,
          body: arch?.body,
          feet: arch?.feet,
        },
      });
    }
    return roster;
  }

  /**
   * Recruits a new soldier.
   */
  public recruitSoldier(
    state: CampaignState,
    archetypeId: string,
    name: string,
  ): string {
    const COST = 100;
    if (state.scrap < COST) {
      throw new Error("Insufficient scrap to recruit soldier.");
    }

    const arch = ArchetypeLibrary[archetypeId];
    if (!arch) {
      throw new Error(`Invalid archetype ID: ${archetypeId}`);
    }

    const newSoldier: CampaignSoldier = {
      id: `soldier_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name,
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

    state.scrap -= COST;
    state.roster.push(newSoldier);
    return newSoldier.id;
  }

  /**
   * Heals a wounded soldier.
   */
  public healSoldier(state: CampaignState, soldierId: string): void {
    const COST = 50;
    if (state.scrap < COST) {
      throw new Error("Insufficient scrap to heal soldier.");
    }

    const soldier = state.roster.find((s) => s.id === soldierId);
    if (!soldier) {
      throw new Error(`Soldier not found: ${soldierId}`);
    }

    if (soldier.status !== "Wounded") {
      throw new Error("Soldier is not wounded.");
    }

    state.scrap -= COST;
    soldier.status = "Healthy";
    soldier.hp = soldier.maxHp;
  }

  /**
   * Revives a dead soldier.
   */
  public reviveSoldier(state: CampaignState, soldierId: string): void {
    if (state.rules.deathRule !== "Clone") {
      throw new Error("Revival only allowed in 'Clone' mode.");
    }

    const COST = 250;
    if (state.scrap < COST) {
      throw new Error("Insufficient scrap to revive soldier.");
    }

    const soldier = state.roster.find((s) => s.id === soldierId);
    if (!soldier) {
      throw new Error(`Soldier not found: ${soldierId}`);
    }

    if (soldier.status !== "Dead") {
      throw new Error("Soldier is not dead.");
    }

    state.scrap -= COST;
    soldier.status = "Healthy";
    soldier.hp = soldier.maxHp;
  }

  /**
   * Assigns equipment to a soldier.
   */
  public assignEquipment(
    state: CampaignState,
    soldierId: string,
    equipment: EquipmentState,
  ): void {
    const soldier = state.roster.find((s) => s.id === soldierId);
    if (!soldier) {
      throw new Error(`Soldier not found: ${soldierId}`);
    }

    soldier.equipment = { ...equipment };
  }
}
