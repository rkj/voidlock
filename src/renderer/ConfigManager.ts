import { MapGeneratorType, MissionType, UnitStyle } from "@src/shared/types";
import type { SquadConfig, SquadSoldierConfig } from "@src/shared/types";
import { GameConfigSchema, GlobalConfigSchema } from "@src/shared/schemas";

export interface GameConfig {
  mapWidth: number;
  mapHeight: number;
  spawnPointCount: number;
  fogOfWarEnabled: boolean;
  debugOverlayEnabled: boolean;
  losOverlayEnabled: boolean;
  agentControlEnabled: boolean;
  allowTacticalPause: boolean;
  mapGeneratorType: MapGeneratorType;
  missionType: MissionType;
  lastSeed: number;
  startingThreatLevel: number;
  baseEnemyCount: number;
  enemyGrowthPerMission: number;
  bonusLootCount: number;
  manualDeployment: boolean;
  campaignNodeId?: string;
  squadConfig: SquadConfig;
}

export interface GlobalConfig {
  unitStyle: UnitStyle;
  themeId: string;
}

const CUSTOM_STORAGE_KEY = "voidlock_custom_config";
const CAMPAIGN_STORAGE_KEY = "voidlock_campaign_config";
const GLOBAL_STORAGE_KEY = "voidlock_global_config";

export class ConfigManager {
  public static saveCustom(config: GameConfig, global?: GlobalConfig) {
    if (global) {
      this.saveGlobal(global);
    }
    this.save(CUSTOM_STORAGE_KEY, config);
  }

  public static saveCampaign(config: GameConfig, global?: GlobalConfig) {
    if (global) {
      this.saveGlobal(global);
    }
    this.save(CAMPAIGN_STORAGE_KEY, config);
  }

  public static saveGlobal(config: GlobalConfig) {
    try {
      localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn("Failed to save global configuration:", e);
    }
  }

  public static loadGlobal(): GlobalConfig {
    const defaultGlobal: GlobalConfig = {
      unitStyle: UnitStyle.TacticalIcons,
      themeId: "default",
    };

    try {
      const json = localStorage.getItem(GLOBAL_STORAGE_KEY);
      if (!json) return defaultGlobal;
      const loaded = JSON.parse(json);

      const result = GlobalConfigSchema.safeParse(loaded);
      if (result.success) {
        return result.data as GlobalConfig;
      }
      return defaultGlobal;
    } catch (e) {
      return defaultGlobal;
    }
  }

  public static clearCampaign() {
    localStorage.removeItem(CAMPAIGN_STORAGE_KEY);
    console.log(`Campaign configuration cleared from LocalStorage.`);
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
      const loaded = JSON.parse(json);

      const result = GameConfigSchema.safeParse(loaded);
      if (result.success) {
        return result.data as GameConfig;
      }

      // If validation fails, we can still try to recover using the manual merger
      // to avoid breaking user settings on minor schema changes.
      console.warn(
        `ConfigManager: Validation failed for ${key}, attempting recovery.`,
      );
      const defaults = this.getDefault();
      if (typeof loaded === "object" && loaded !== null) {
        return this.validateAndMerge(
          loaded as Record<string, unknown>,
          defaults,
        );
      }
      return null;
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
      "manualDeployment",
    ];
    for (const field of booleanFields) {
      const val = loaded[field];
      if (typeof val === "boolean") {
        (result as Record<string, unknown>)[field] = val;
      }
    }

    // String fields
    if (typeof loaded.campaignNodeId === "string") {
      result.campaignNodeId = loaded.campaignNodeId;
    }

    // Enum fields
    if (
      Object.values(MapGeneratorType).includes(
        loaded.mapGeneratorType as MapGeneratorType,
      )
    ) {
      result.mapGeneratorType = loaded.mapGeneratorType as MapGeneratorType;
    }
    if (
      Object.values(MissionType).includes(loaded.missionType as MissionType)
    ) {
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
      mapWidth: 10,
      mapHeight: 10,
      spawnPointCount: 3,
      fogOfWarEnabled: true,
      debugOverlayEnabled: false,
      losOverlayEnabled: false,
      agentControlEnabled: true,
      allowTacticalPause: true,
      mapGeneratorType: MapGeneratorType.DenseShip,
      missionType: MissionType.Default,
      lastSeed: Date.now(),
      startingThreatLevel: 0,
      baseEnemyCount: 3,
      enemyGrowthPerMission: 1,
      bonusLootCount: 0,
      manualDeployment: true,
      squadConfig: {
        soldiers: [{ archetypeId: "assault" }, { archetypeId: "medic" }],
        inventory: { medkit: 1, frag_grenade: 2 },
      },
    };
  }
}
