import {
  MapGeneratorType,
  SquadConfig,
  MapDefinition,
  MissionType,
} from "../shared/types";

export interface GameConfig {
  mapWidth: number;
  mapHeight: number;
  spawnPointCount: number;
  fogOfWarEnabled: boolean;
  debugOverlayEnabled: boolean;
  losOverlayEnabled: boolean; // Added
  agentControlEnabled: boolean;
  mapGeneratorType: MapGeneratorType;
  missionType: MissionType;
  lastSeed: number;
  startingThreatLevel: number;
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
      const config = JSON.parse(json) as GameConfig;
      const defaults = this.getDefault();

      // Migration/Defaulting: Ensure squadConfig and soldiers exist and are in the correct format
      if (!config.squadConfig || Array.isArray(config.squadConfig)) {
        config.squadConfig = defaults.squadConfig;
      } else {
        if (!config.squadConfig.soldiers) {
          config.squadConfig.soldiers = defaults.squadConfig.soldiers;
        }
        if (!config.squadConfig.inventory) {
          config.squadConfig.inventory = defaults.squadConfig.inventory;
        }
      }

      return config;
    } catch (e) {
      console.warn(
        `Failed to load configuration from LocalStorage (${key}):`,
        e,
      );
      return null;
    }
  }

  public static getDefault(): GameConfig {
    return {
      mapWidth: 14,
      mapHeight: 14,
      spawnPointCount: 3,
      fogOfWarEnabled: true,
      debugOverlayEnabled: false,
      losOverlayEnabled: false, // Added
      agentControlEnabled: true,
      mapGeneratorType: MapGeneratorType.TreeShip,
      missionType: MissionType.Default,
      lastSeed: Date.now(),
      startingThreatLevel: 0,
      squadConfig: {
        soldiers: [{ archetypeId: "assault" }, { archetypeId: "medic" }],
        inventory: { medkit: 1, frag_grenade: 2 },
      },
    };
  }
}
