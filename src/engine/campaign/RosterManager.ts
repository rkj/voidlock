import { CampaignState, CampaignSoldier } from "../../shared/campaign_types";
import { ArchetypeLibrary, EquipmentState } from "../../shared/types";
import {
  DEFAULT_ARCHETYPES,
  CAMPAIGN_DEFAULTS,
} from "../config/CampaignDefaults";
import { RosterUtils } from "./RosterUtils";

/**
 * Handles roster-related logic for the campaign.
 */
export class RosterManager {
  /**
   * Generates the initial roster of soldiers for a new campaign.
   * @param unlockedArchetypes Optional list of available archetypes. Defaults to DEFAULT_ARCHETYPES.
   */
  public generateInitialRoster(
    unlockedArchetypes?: string[],
  ): CampaignSoldier[] {
    const archetypes = unlockedArchetypes || [...DEFAULT_ARCHETYPES];
    const roster: CampaignSoldier[] = [];

    for (let i = 0; i < CAMPAIGN_DEFAULTS.INITIAL_ROSTER_SIZE; i++) {
      const archId = archetypes[i % archetypes.length];
      const arch = ArchetypeLibrary[archId];
      roster.push({
        id: `soldier_${i}`,
        name: RosterUtils.getRandomName(roster),
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
    name?: string,
  ): string {
    const COST = 100;
    if (state.scrap < COST) {
      throw new Error("Insufficient scrap to recruit soldier.");
    }

    if (state.roster.length >= CAMPAIGN_DEFAULTS.MAX_ROSTER_SIZE) {
      throw new Error(
        `Roster is full (max ${CAMPAIGN_DEFAULTS.MAX_ROSTER_SIZE} soldiers).`,
      );
    }

    if (!state.unlockedArchetypes.includes(archetypeId)) {
      throw new Error(`Archetype ${archetypeId} is not unlocked.`);
    }

    const arch = ArchetypeLibrary[archetypeId];
    if (!arch) {
      throw new Error(`Invalid archetype ID: ${archetypeId}`);
    }

    const finalName = name || RosterUtils.getRandomName(state.roster);

    const newSoldier: CampaignSoldier = {
      id: `soldier_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
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

  /**
   * Renames a soldier.
   */
  public renameSoldier(
    state: CampaignState,
    soldierId: string,
    newName: string,
  ): void {
    const soldier = state.roster.find((s) => s.id === soldierId);
    if (!soldier) {
      throw new Error(`Soldier not found: ${soldierId}`);
    }

    if (!newName || newName.trim().length === 0) {
      throw new Error("Invalid name.");
    }

    soldier.name = newName.trim();
  }
}
