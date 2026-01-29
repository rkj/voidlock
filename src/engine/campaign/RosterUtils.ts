import { CampaignSoldier } from "../../shared/campaign_types";
import { SOLDIER_NAMES } from "../config/SoldierNames";
import { PRNG } from "../../shared/PRNG";

/**
 * Utility functions for roster management.
 */
export class RosterUtils {
  /**
   * Picks a random name from the curated list, avoiding duplicates if possible.
   */
  public static getRandomName(roster: CampaignSoldier[], prng?: PRNG): string {
    const existingNames = new Set(roster.map((s) => s.name));
    const availableNames = SOLDIER_NAMES.filter((n) => !existingNames.has(n));
    const pool = availableNames.length > 0 ? availableNames : SOLDIER_NAMES;
    
    const index = prng 
      ? Math.floor(prng.next() * pool.length)
      : Math.floor(Math.random() * pool.length);
      
    return pool[index];
  }

  /**
   * Finds the next available tactical number (1-9) for a soldier.
   */
  public static getNextTacticalNumber(roster: CampaignSoldier[]): number {
    const usedNumbers = new Set(roster.map((s) => s.tacticalNumber));
    for (let i = 1; i <= 9; i++) {
      if (!usedNumbers.has(i)) return i;
    }
    // Fallback: pick one that is least used or just random 1-9
    return Math.floor(Math.random() * 9) + 1;
  }
}
