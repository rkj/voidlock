import type { CampaignState, CampaignSoldier } from "../../shared/campaign_types";
import {
  DEFAULT_ARCHETYPES,
  CAMPAIGN_DEFAULTS,
} from "../config/CampaignDefaults";
import { SoldierFactory } from "./SoldierFactory";
import type { PRNG } from "../../shared/PRNG";

/**
 * Handles roster-related logic for the campaign.
 */
export class RosterManager {
  /**
   * Generates the initial roster of soldiers for a new campaign.
   * @param prng Optional PRNG for random generation.
   * @param unlockedArchetypes Optional list of available archetypes. Defaults to DEFAULT_ARCHETYPES.
   */
  public static generateInitialRoster(
    prng: PRNG,
    unlockedArchetypes?: string[],
  ): CampaignSoldier[] {
    const archetypes = (unlockedArchetypes && unlockedArchetypes.length > 0) 
      ? unlockedArchetypes 
      : [...DEFAULT_ARCHETYPES];
    const roster: CampaignSoldier[] = [];

    for (let i = 0; i < CAMPAIGN_DEFAULTS.INITIAL_ROSTER_SIZE; i++) {
      const archId = archetypes[i % archetypes.length];
      // Use SoldierFactory to ensure uniform generation
      const soldier = SoldierFactory.createSoldier(archId, roster, {
        id: `soldier_${i}`,
        prng,
      });
      roster.push(soldier);
    }
    return roster;
  }

  /**
   * Recruits a new soldier.
   */
  public static recruitSoldier(
    state: CampaignState,
    archetypeId: string,
    prng: PRNG,
    name?: string,
  ): string {
    const COST = 100;
    if (state.scrap < COST) {
      throw new Error("Not enough Credits to recruit a soldier.");
    }

    if (state.roster.length >= CAMPAIGN_DEFAULTS.MAX_ROSTER_SIZE) {
      throw new Error(
        `Roster is full (max ${CAMPAIGN_DEFAULTS.MAX_ROSTER_SIZE} soldiers).`,
      );
    }

    const soldierName = name ?? `Recruit ${state.roster.length + 1}`;
    const soldier = SoldierFactory.createSoldier(archetypeId, state.roster, {
      name: soldierName,
      prng,
    });
    
    state.roster.push(soldier);
    state.scrap -= COST;

    return soldier.id;
  }

  /**
   * Revives a dead soldier.
   */
  public static reviveSoldier(state: CampaignState, soldierId: string): boolean {
    const COST = 250;
    if (state.scrap < COST) {
      return false;
    }

    const soldier = state.roster.find((s) => s.id === soldierId);
    if (soldier?.status !== "Dead") {
      return false;
    }

    soldier.status = "Healthy";
    soldier.hp = soldier.maxHp;
    state.scrap -= COST;

    return true;
  }

  /**
   * Renames a soldier.
   */
  public static renameSoldier(
    state: CampaignState,
    soldierId: string,
    newName: string,
  ): void {
    const soldier = state.roster.find((s) => s.id === soldierId);
    if (soldier) {
      soldier.name = newName;
    }
  }

  /**
   * Heals a wounded soldier.
   */
  public static healSoldier(
    state: CampaignState,
    soldierId: string,
    cost: number,
  ): boolean {
    if (state.scrap < cost) {
      return false;
    }

    const soldier = state.roster.find((s) => s.id === soldierId);
    if (soldier?.status !== "Wounded") {
      return false;
    }

    soldier.status = "Healthy";
    soldier.hp = soldier.maxHp;
    state.scrap -= cost;

    return true;
  }

  /**
   * Updates a soldier's equipment.
   */
  public static updateSoldierEquipment(
    state: CampaignState,
    soldierId: string,
    equipment: Partial<CampaignSoldier["equipment"]>,
  ): void {
    const soldier = state.roster.find((s) => s.id === soldierId);
    if (soldier) {
      soldier.equipment = { ...soldier.equipment, ...equipment };
    }
  }
}
