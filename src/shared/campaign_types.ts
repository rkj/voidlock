import {
  EquipmentState,
  Vector2,
  MissionType,
  UnitStyle,
  MapGeneratorType,
} from "./types";

/**
 * Difficulty presets for the campaign.
 */
export type CampaignDifficulty = "Simulation" | "Clone" | "Standard" | "Ironman";

/**
 * Difficulty and gameplay settings for the campaign.
 */
export interface GameRules {
  mode: "Custom" | "Preset";
  difficulty: CampaignDifficulty;
  deathRule: "Iron" | "Clone" | "Simulation";
  allowTacticalPause: boolean;
  unitStyle?: UnitStyle;
  mapGeneratorType: MapGeneratorType;
  difficultyScaling: number; // Multiplier for enemy density/stats
  resourceScarcity: number; // Multiplier for scrap rewards
  startingScrap: number; // NEW: Initial funds
  mapGrowthRate: number; // NEW: +MapSize per rank
  baseEnemyCount: number; // NEW: Starting wave size
  enemyGrowthPerMission: number; // NEW: Wave size growth per rank
  themeId?: string;
  customSeed?: number;
}

/**
 * Advanced rule overrides for starting a new campaign.
 */
export interface CampaignOverrides {
  deathRule?: "Iron" | "Clone" | "Simulation";
  allowTacticalPause?: boolean;
  mapGeneratorType?: MapGeneratorType;
  scaling?: number;
  scarcity?: number;
  startingScrap?: number;
  mapGrowthRate?: number;
  baseEnemyCount?: number;
  enemyGrowthPerMission?: number;
  themeId?: string;
  unitStyle?: UnitStyle;
  customSeed?: number;
}

/**
 * Persistent data for a soldier in the campaign roster.
 */
export interface CampaignSoldier {
  id: string;
  name: string;
  archetypeId: string;
  hp: number;
  maxHp: number;
  soldierAim: number;
  xp: number;
  level: number;
  kills: number;
  missions: number;
  status: "Healthy" | "Wounded" | "Dead";
  equipment: EquipmentState;
  recoveryTime?: number; // Missions remaining until available if wounded
}

/**
 * Represents a node on the campaign sector map.
 */
export type CampaignNodeStatus =
  | "Hidden"
  | "Revealed"
  | "Accessible"
  | "Cleared"
  | "Skipped";

/**
 * A node in the Sector Map DAG.
 */
export interface CampaignNode {
  id: string;
  type: CampaignNodeType;
  status: CampaignNodeStatus;
  difficulty: number;
  rank: number; // NEW: Layer/Depth in the DAG
  mapSeed: number;
  connections: string[]; // IDs of child nodes in the DAG
  position: Vector2;
  missionType?: MissionType;
}

/**
 * Result of a single soldier's performance in a mission.
 */
export interface SoldierMissionResult {
  soldierId: string;
  xpBefore: number;
  xpGained: number;
  kills: number;
  promoted: boolean;
  newLevel?: number;
  status: "Healthy" | "Wounded" | "Dead";
  recoveryTime?: number;
}

/**
 * A detailed report of a completed mission.
 */
export interface MissionReport {
  nodeId: string;
  seed: number;
  result: "Won" | "Lost";
  aliensKilled: number;
  scrapGained: number;
  intelGained: number;
  timeSpent: number; // Duration in ticks
  soldierResults: SoldierMissionResult[];
}

/**
 * The root object for a campaign run's state.
 */
export interface CampaignState {
  version: string;
  seed: number;
  status: "Active" | "Victory" | "Defeat";
  rules: GameRules;
  scrap: number;
  intel: number;
  currentSector: number;
  currentNodeId: string | null;
  nodes: CampaignNode[];
  roster: CampaignSoldier[];
  history: MissionReport[];
  unlockedArchetypes: string[];
}

/**
 * XP required to reach each level.
 * Level 1: 0-99
 * Level 2: 100-249
 * Level 3: 250-499
 * Level 4: 500-999
 * Level 5: 1000+
 */
export const XP_THRESHOLDS = [0, 100, 250, 500, 1000];

export const STAT_BOOSTS = {
  hpPerLevel: 20,
  aimPerLevel: 5,
};

/**
 * Calculates the level for a given amount of XP.
 */
export function calculateLevel(xp: number): number {
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

/**
 * Calculates the map dimensions based on rank and growth rate.
 */
export function calculateMapSize(rank: number, growthRate: number): number {
  const BASE_SIZE = 6;
  const CAP = 12;
  return Math.min(CAP, BASE_SIZE + Math.floor(rank * growthRate));
}

/**
 * Calculates the number of spawn points based on map size.
 */
export function calculateSpawnPoints(mapSize: number): number {
  return 1 + Math.floor((mapSize - 6) / 2);
}
