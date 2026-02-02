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
}
