import { MapGeneratorType, MissionType, UnitStyle } from "@src/shared/types";
import type {
  SquadConfig,
  SquadSoldierConfig,
} from "@src/shared/types";

export interface GameConfig {
  mapWidth: number;
  mapHeight: number;
  spawnPointCount: number;
  fogOfWarEnabled: boolean;
  debugOverlayEnabled: boolean;
  losOverlayEnabled: boolean; // Added
  agentControlEnabled: boolean;
  allowTacticalPause: boolean;
  unitStyle: UnitStyle; // New
  mapGeneratorType: MapGeneratorType;
  missionType: MissionType;
  lastSeed: number;
  themeId: string; // Added
  startingThreatLevel: number;
  baseEnemyCount: number;
  enemyGrowthPerMission: number;
  bonusLootCount: number;
  campaignNodeId?: string; // Added
  // staticMapData is tricky to serialize if large, but per spec we should probably try or just skip if it's user uploaded file that isn't persistent.
  // For now, let's persist everything except maybe large static maps if they exceed limits, but let's try basic props first.
  squadConfig: SquadConfig;
}

const CUSTOM_STORAGE_KEY = "voidlock_custom_config";
const CAMPAIGN_STORAGE_KEY = "voidlock_campaign_config";

export class ConfigManager {
  public static saveCustom(config: GameConfig) {
    this.save(CUSTOM_STORAGE_KEY, config);
  }

  public static saveCampaign(config: GameConfig) {
    this.save(CAMPAIGN_STORAGE_KEY, config);
  }

  private static save(key: string, config: GameConfig) {
    try {
      const json = JSON.stringify(config);
      localStorage.setItem(key, json);
      console.log(`Configuration saved to LocalStorage (${key}).`);
    } catch (e) {
      console.warn(`Failed to save configuration to LocalStorage (${key}):`, e);
    }
  }

  public static loadCustom(): GameConfig | null {
    const config = this.load(CUSTOM_STORAGE_KEY);
    if (config) return config;

    // Migration from old keys
    const oldConfig =
      this.load("voidlock_legacy_custom_config") ||
      this.load("voidlock_legacy_config");
    if (oldConfig) {
      this.saveCustom(oldConfig);
      return oldConfig;
    }

    return null;
  }

  public static loadCampaign(): GameConfig | null {
    const config = this.load(CAMPAIGN_STORAGE_KEY);
    if (config) return config;

    // Migration from old key
    const oldCampaign = this.load("voidlock_legacy_campaign_config");
    if (oldCampaign) {
      this.saveCampaign(oldCampaign);
      return oldCampaign;
    }

    return null;
  }

  private static load(key: string): GameConfig | null {
    try {
      const json = localStorage.getItem(key);
      if (!json) return null;
      const loaded = JSON.parse(json) as unknown;

      const defaults = this.getDefault();

      // Ensure config is an object
      if (typeof loaded !== "object" || loaded === null) {
        return null;
      }

      // Deep validate and merge with defaults
      const config = this.validateAndMerge(
        loaded as Record<string, unknown>,
        defaults,
      );

      return config;
    } catch (e) {
      console.warn(
        `Failed to load configuration from LocalStorage (${key}):`,
        e,
      );
      return null;
    }
  }

  private static validateAndMerge(
    loaded: Record<string, unknown>,
    defaults: GameConfig,
  ): GameConfig {
    const result = { ...defaults };

    // Numeric fields
    const numericFields: (keyof GameConfig)[] = [
      "mapWidth",
      "mapHeight",
      "spawnPointCount",
      "lastSeed",
      "startingThreatLevel",
      "baseEnemyCount",
      "enemyGrowthPerMission",
      "bonusLootCount",
    ];
    for (const field of numericFields) {
      const val = loaded[field];
      if (typeof val === "number" && !isNaN(val)) {
        (result as Record<string, unknown>)[field] = val;
      }
    }

    // Boolean fields
    const booleanFields: (keyof GameConfig)[] = [
      "fogOfWarEnabled",
      "debugOverlayEnabled",
      "losOverlayEnabled",
      "agentControlEnabled",
      "allowTacticalPause",
    ];
    for (const field of booleanFields) {
      const val = loaded[field];
      if (typeof val === "boolean") {
        (result as Record<string, unknown>)[field] = val;
      }
    }

    // String fields
    if (typeof loaded.themeId === "string") {
      result.themeId = loaded.themeId;
    }
    if (typeof loaded.campaignNodeId === "string") {
      result.campaignNodeId = loaded.campaignNodeId;
    }

    // Enum fields
    if (Object.values(UnitStyle).includes(loaded.unitStyle as UnitStyle)) {
      result.unitStyle = loaded.unitStyle as UnitStyle;
    }
    if (
      Object.values(MapGeneratorType).includes(
        loaded.mapGeneratorType as MapGeneratorType,
      )
    ) {
      result.mapGeneratorType = loaded.mapGeneratorType as MapGeneratorType;
    }
    if (Object.values(MissionType).includes(loaded.missionType as MissionType)) {
      result.missionType = loaded.missionType as MissionType;
    }

    // Complex fields: squadConfig
    const loadedSquad = loaded.squadConfig;
    if (
      loadedSquad &&
      typeof loadedSquad === "object" &&
      !Array.isArray(loadedSquad)
    ) {
      const squad = loadedSquad as Record<string, unknown>;
      if (Array.isArray(squad.soldiers)) {
        result.squadConfig.soldiers = squad.soldiers.filter(
          (s: unknown) =>
            s &&
            typeof s === "object" &&
            "archetypeId" in s &&
            typeof (s as Record<string, unknown>).archetypeId === "string",
        ) as SquadSoldierConfig[];
        if (result.squadConfig.soldiers.length === 0) {
          result.squadConfig.soldiers = [...defaults.squadConfig.soldiers];
        }
      }

      if (squad.inventory && typeof squad.inventory === "object") {
        result.squadConfig.inventory = {
          ...(squad.inventory as Record<string, number>),
        };
      }
    }

    return result;
  }

  public static getDefault(): GameConfig {
    return {
      mapWidth: 14,
      mapHeight: 14,
      spawnPointCount: 5,
      fogOfWarEnabled: true,
      debugOverlayEnabled: false,
      losOverlayEnabled: false, // Added
      agentControlEnabled: true,
      allowTacticalPause: true,
      unitStyle: UnitStyle.TacticalIcons,
      mapGeneratorType: MapGeneratorType.DenseShip,
      missionType: MissionType.Default,
      lastSeed: Date.now(),
      themeId: "default",
      startingThreatLevel: 0,
      baseEnemyCount: 3,
      enemyGrowthPerMission: 1,
      bonusLootCount: 0,
      squadConfig: {
        soldiers: [{ archetypeId: "assault" }, { archetypeId: "medic" }],
        inventory: { medkit: 1, frag_grenade: 2 },
      },
    };
  }
}