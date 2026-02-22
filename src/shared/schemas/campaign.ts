import { z } from "zod";
import { Vector2Schema } from "./common";

export const MapGeneratorTypeSchema = z.enum([
  "Procedural",
  "Static",
  "TreeShip",
  "DenseShip",
]);

export const CampaignDifficultySchema = z.enum([
  "Simulation",
  "Clone",
  "Standard",
  "Ironman",
]);

export const GameRulesSchema = z.object({
  mode: z.enum(["Custom", "Preset"]).default("Custom"),
  difficulty: CampaignDifficultySchema.default("Clone"),
  deathRule: z.enum(["Iron", "Clone", "Simulation"]).default("Clone"),
  allowTacticalPause: z.boolean().default(true),
  mapGeneratorType: MapGeneratorTypeSchema.default("DenseShip"),
  difficultyScaling: z.number().default(1.0),
  resourceScarcity: z.number().default(1.0),
  startingScrap: z.number().default(500),
  mapGrowthRate: z.number().default(0.5),
  baseEnemyCount: z.number().default(3),
  enemyGrowthPerMission: z.number().default(1.0),
  economyMode: z.enum(["Open", "Limited"]).default("Open"),
  skipPrologue: z.boolean().default(false),
  customSeed: z.number().optional(),
});

export const EquipmentStateSchema = z
  .object({
    body: z.string().optional(),
    feet: z.string().optional(),
    rightHand: z.string().optional(),
    leftHand: z.string().optional(),
  })
  .default({});

export const CampaignSoldierSchema = z.object({
  id: z.string(),
  name: z.string(),
  archetypeId: z.string(),
  hp: z.number().default(100),
  maxHp: z.number().default(100),
  soldierAim: z.number().default(60),
  xp: z.number().default(0),
  level: z.number().default(1),
  kills: z.number().default(0),
  missions: z.number().default(0),
  status: z.enum(["Healthy", "Wounded", "Dead"]).default("Healthy"),
  equipment: EquipmentStateSchema,
  recoveryTime: z.number().default(0),
});

export const CampaignNodeTypeSchema = z.enum([
  "Combat",
  "Elite",
  "Shop",
  "Event",
  "Boss",
]);

export const CampaignNodeStatusSchema = z.enum([
  "Hidden",
  "Revealed",
  "Accessible",
  "Cleared",
  "Skipped",
]);

export const MissionTypeSchema = z.enum([
  "Default",
  "ExtractArtifacts",
  "DestroyHive",
  "EscortVIP",
  "RecoverIntel",
  "Prologue",
]);

export const CampaignNodeSchema = z.object({
  id: z.string(),
  type: CampaignNodeTypeSchema.default("Combat"),
  status: CampaignNodeStatusSchema.default("Hidden"),
  difficulty: z.number().default(1),
  rank: z.number().default(0),
  mapSeed: z.number().default(0),
  connections: z.array(z.string()).default([]),
  position: Vector2Schema.default({ x: 0, y: 0 }),
  missionType: MissionTypeSchema.optional(),
  bonusLootCount: z.number().default(0),
});

export const SoldierMissionResultSchema = z.object({
  soldierId: z.string(),
  name: z.string().optional(),
  tacticalNumber: z.number().optional(),
  xpBefore: z.number(),
  xpGained: z.number(),
  kills: z.number(),
  promoted: z.boolean(),
  newLevel: z.number().optional(),
  status: z.enum(["Healthy", "Wounded", "Dead"]),
  recoveryTime: z.number().optional(),
});

export const MissionReportSchema = z.object({
  nodeId: z.string(),
  seed: z.number(),
  result: z.enum(["Won", "Lost"]),
  aliensKilled: z.number(),
  scrapGained: z.number(),
  intelGained: z.number(),
  timeSpent: z.number(),
  soldierResults: z.array(SoldierMissionResultSchema),
});

export const CampaignStateSchema = z.object({
  version: z.string(),
  saveVersion: z.number().default(1),
  seed: z.number(),
  status: z.enum(["Active", "Victory", "Defeat"]).default("Active"),
  rules: GameRulesSchema,
  scrap: z.number().default(0),
  intel: z.number().default(0),
  currentSector: z.number().default(1),
  currentNodeId: z.string().nullable().default(null),
  nodes: z.array(CampaignNodeSchema),
  roster: z.array(CampaignSoldierSchema),
  history: z.array(MissionReportSchema).default([]),
  unlockedArchetypes: z
    .array(z.string())
    .default(["assault", "medic", "scout"]),
  unlockedItems: z.array(z.string()).default([]),
});

export const CampaignSummarySchema = z.object({
  campaignId: z.string(),
  updatedAt: z.number(),
  sector: z.number(),
  difficulty: CampaignDifficultySchema,
  status: z.enum(["Active", "Victory", "Defeat"]),
  soldierCount: z.number(),
});

export const MetaStatsSchema = z.object({
  totalCampaignsStarted: z.number().default(0),
  campaignsWon: z.number().default(0),
  campaignsLost: z.number().default(0),
  totalKills: z.number().default(0),
  totalCasualties: z.number().default(0),
  totalMissionsPlayed: z.number().default(0),
  totalMissionsWon: z.number().default(0),
  totalScrapEarned: z.number().default(0),
  currentIntel: z.number().default(0),
  unlockedArchetypes: z.array(z.string()).default([]),
  unlockedItems: z.array(z.string()).default([]),
  prologueCompleted: z.boolean().default(false),
});

export type CampaignState = z.infer<typeof CampaignStateSchema>;
export type MetaStats = z.infer<typeof MetaStatsSchema>;
