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
export interface CampaignSoldier {
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

/**
 * A node in the Sector Map DAG.
 */
export interface CampaignNode {
  id: string;
  type: CampaignNodeType;
  status: CampaignNodeStatus;
  difficulty: number;
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
  xpGained: number;
  kills: number;
  promoted: boolean;
  newLevel?: number;
  status: "Healthy" | "Wounded" | "Dead";
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