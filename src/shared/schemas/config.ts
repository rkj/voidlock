import { z } from "zod";
import { MapGeneratorTypeSchema, MissionTypeSchema } from "./campaign";
import { SquadConfigSchema } from "./units";

export const GameConfigSchema = z.object({
  mapWidth: z.number().int().min(6).max(100),
  mapHeight: z.number().int().min(6).max(100),
  spawnPointCount: z.number().int().min(1),
  fogOfWarEnabled: z.boolean(),
  debugOverlayEnabled: z.boolean(),
  losOverlayEnabled: z.boolean(),
  agentControlEnabled: z.boolean(),
  allowTacticalPause: z.boolean(),
  mapGeneratorType: MapGeneratorTypeSchema,
  missionType: MissionTypeSchema,
  lastSeed: z.number(),
  startingThreatLevel: z.number(),
  baseEnemyCount: z.number(),
  enemyGrowthPerMission: z.number(),
  bonusLootCount: z.number(),
  manualDeployment: z.boolean(),
  campaignNodeId: z.string().optional(),
  squadConfig: SquadConfigSchema,
});

export const GlobalConfigSchema = z.object({
  unitStyle: z.enum(["Sprites", "TacticalIcons"]),
  themeId: z.string(),
  logLevel: z.enum(["DEBUG", "INFO", "WARN", "ERROR", "NONE"]),
  debugSnapshots: z.boolean(),
  debugOverlayEnabled: z.boolean(),
});
