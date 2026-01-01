// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConfigManager } from "./ConfigManager";
import { MapGeneratorType, MissionType } from "../shared/types";

describe("ConfigManager Migration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should handle missing soldiers in squadConfig (old format migration)", () => {
    const oldConfig = {
      mapWidth: 14,
      mapHeight: 14,
      spawnPointCount: 3,
      fogOfWarEnabled: true,
      debugOverlayEnabled: false,
      losOverlayEnabled: false,
      agentControlEnabled: true,
      mapGeneratorType: MapGeneratorType.TreeShip,
      missionType: MissionType.Default,
      lastSeed: 12345,
      startingThreatLevel: 0,
      squadConfig: {
        // soldiers is missing!
        inventory: { medkit: 1 },
      },
    };

    localStorage.setItem("xenopurge_config", JSON.stringify(oldConfig));

    const loadedConfig = ConfigManager.load();
    expect(loadedConfig).not.toBeNull();
    expect(loadedConfig?.squadConfig.soldiers).toBeDefined();
    expect(Array.isArray(loadedConfig?.squadConfig.soldiers)).toBe(true);
    expect(loadedConfig?.squadConfig.soldiers.length).toBeGreaterThan(0);
  });

      it("should handle entirely missing squadConfig", () => {
        const oldConfig = {
          mapWidth: 14,
          mapHeight: 14,
          // squadConfig missing
        };
    
        localStorage.setItem("xenopurge_config", JSON.stringify(oldConfig));
    
        const loadedConfig = ConfigManager.load();
        expect(loadedConfig).not.toBeNull();
        expect(loadedConfig?.squadConfig).toBeDefined();
        expect(loadedConfig?.squadConfig.soldiers).toBeDefined();
      });
  
      it("should handle very old array-based squadConfig format", () => {
        const oldConfig = {
          squadConfig: [{ archetypeId: "assault" }] // Old format was just an array
        };
  
        localStorage.setItem("xenopurge_config", JSON.stringify(oldConfig));
  
        const loadedConfig = ConfigManager.load();
        expect(loadedConfig).not.toBeNull();
        expect(loadedConfig?.squadConfig.soldiers).toBeDefined();
        expect(Array.isArray(loadedConfig?.squadConfig.soldiers)).toBe(true);
        // It should probably have defaulted back to the default squad since it was an array
        expect(loadedConfig?.squadConfig.inventory).toBeDefined();
      });
  });
