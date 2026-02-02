import pkg from "../../../package.json";

export const DEFAULT_ARCHETYPES = [
  "assault",
  "medic",
  "scout",
  "heavy",
] as const;
export type DefaultArchetype = (typeof DEFAULT_ARCHETYPES)[number];

export const CAMPAIGN_DEFAULTS = {
  VERSION: pkg.version,
  STARTING_SCRAP: 100,
  STARTING_INTEL: 0,
  STARTING_SECTOR: 1, // Based on CampaignManager.ts line 158: currentSector: 1
  UNLOCKED_ARCHETYPES: DEFAULT_ARCHETYPES,
  INITIAL_ROSTER_SIZE: 4,
  MAX_ROSTER_SIZE: 12,
  STORAGE_KEY: "voidlock_campaign_v1",
  META_STORAGE_KEY: "voidlock_meta_v1",
} as const;
