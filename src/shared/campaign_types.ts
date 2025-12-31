import { EquipmentState, Vector2, MissionType } from "./types";

/**
 * Difficulty and gameplay settings for the campaign.
 */
export interface GameRules {
  mode: "Custom" | "Preset";
  deathRule: "Iron" | "Clone" | "Simulation";
  difficultyScaling: number; // Multiplier for enemy density/stats
  resourceScarcity: number; // Multiplier for scrap rewards
}

/**
 * Persistent data for a soldier in the campaign roster.
 */
export interface PersistentSoldier {
  id: string;
  name: string;
  archetypeId: string;
  hp: number;
  maxHp: number;
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
export type CampaignNodeType = "Combat" | "Elite" | "Shop" | "Event" | "Boss";
export type CampaignNodeStatus =
  | "Hidden"
  | "Revealed"
  | "Accessible"
  | "Cleared";

export interface CampaignNode {
  id: string;
  type: CampaignNodeType;
  status: CampaignNodeStatus;
  difficulty: number;
  mapSeed: number;
  connections: string[];
  position: Vector2;
  missionType?: MissionType;
}

/**
 * A record of a completed mission.
 */
export interface MissionRecord {
  nodeId: string;
  seed: number;
  result: "Won" | "Lost";
  aliensKilled: number;
  casualties: number;
  scrapGained: number;
  intelGained: number;
  timeSpent: number; // Duration in ticks
}

/**
 * The root object for a campaign run's state.
 */
export interface CampaignState {
  version: string;
  seed: number;
  rules: GameRules;
  scrap: number;
  intel: number;
  currentSector: number;
  currentNodeId: string | null;
  nodes: CampaignNode[];
  roster: PersistentSoldier[];
  history: MissionRecord[];
  unlockedArchetypes: string[];
}
