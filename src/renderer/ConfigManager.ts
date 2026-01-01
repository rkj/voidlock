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

const STORAGE_KEY = "xenopurge_config";

export class ConfigManager {
  public static save(config: GameConfig) {
    try {
      const json = JSON.stringify(config);
      localStorage.setItem(STORAGE_KEY, json);
      console.log("Configuration saved to LocalStorage.");
    } catch (e) {
      console.warn("Failed to save configuration to LocalStorage:", e);
    }
  }

  public static load(): GameConfig | null {
    try {
      const json = localStorage.getItem(STORAGE_KEY);
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
      console.warn("Failed to load configuration from LocalStorage:", e);
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
