import {
  MapGeneratorType,
  SquadConfig,
  MapDefinition,
  MissionType,
  UnitStyle,
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
  startingThreatLevel: number;
  baseEnemyCount: number;
  enemyGrowthPerMission: number;
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
    const oldConfig = this.load("voidlock_legacy_custom_config") || this.load("voidlock_legacy_config");
    if (oldConfig) {
      this.saveCustom(oldConfig);
      // Optional: localStorage.removeItem("voidlock_legacy_custom_config");
      // Optional: localStorage.removeItem("voidlock_legacy_config");
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
      let config = JSON.parse(json);
      
      const defaults = this.getDefault();

      // Ensure config is an object
      if (typeof config !== "object" || config === null) {
        return null;
      }

      // Deep validate and merge with defaults
      config = this.validateAndMerge(config, defaults);

      return config as GameConfig;
    } catch (e) {
      console.warn(
        `Failed to load configuration from LocalStorage (${key}):`,
        e,
      );
      return null;
    }
  }

  private static validateAndMerge(loaded: any, defaults: GameConfig): GameConfig {
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
    ];
    for (const field of numericFields) {
      if (typeof loaded[field] === "number" && !isNaN(loaded[field])) {
        (result as any)[field] = loaded[field];
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
      if (typeof loaded[field] === "boolean") {
        (result as any)[field] = loaded[field];
      }
    }

    // Enum fields
    if (Object.values(UnitStyle).includes(loaded.unitStyle)) {
      result.unitStyle = loaded.unitStyle;
    }
    if (Object.values(MapGeneratorType).includes(loaded.mapGeneratorType)) {
      result.mapGeneratorType = loaded.mapGeneratorType;
    }
    if (Object.values(MissionType).includes(loaded.missionType)) {
      result.missionType = loaded.missionType;
    }

    // Complex fields: squadConfig
    if (loaded.squadConfig && typeof loaded.squadConfig === "object" && !Array.isArray(loaded.squadConfig)) {
      if (Array.isArray(loaded.squadConfig.soldiers)) {
        result.squadConfig.soldiers = loaded.squadConfig.soldiers.filter((s: any) => 
          s && typeof s === "object" && typeof s.archetypeId === "string"
        );
        if (result.squadConfig.soldiers.length === 0) {
          result.squadConfig.soldiers = [...defaults.squadConfig.soldiers];
        }
      }

      if (loaded.squadConfig.inventory && typeof loaded.squadConfig.inventory === "object") {
        result.squadConfig.inventory = { ...loaded.squadConfig.inventory };
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
      mapGeneratorType: MapGeneratorType.TreeShip,
      missionType: MissionType.Default,
      lastSeed: Date.now(),
      startingThreatLevel: 0,
      baseEnemyCount: 3,
      enemyGrowthPerMission: 1,
      squadConfig: {
        soldiers: [{ archetypeId: "assault" }, { archetypeId: "medic" }],
        inventory: { medkit: 1, frag_grenade: 2 },
      },
    };
  }
}
