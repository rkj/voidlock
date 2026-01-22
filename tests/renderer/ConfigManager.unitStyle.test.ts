/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConfigManager } from "../../src/renderer/ConfigManager";
import {
  MapGeneratorType,
  MissionType,
  UnitStyle,
} from "../../src/shared/types";

describe("ConfigManager - unitStyle", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should have default unitStyle as TacticalIcons", () => {
    const config = ConfigManager.getDefault();
    expect(config.unitStyle).toBe(UnitStyle.TacticalIcons);
  });

  it("should persist and load unitStyle", () => {
    const config = ConfigManager.getDefault();
    config.unitStyle = UnitStyle.Sprites;
    ConfigManager.saveCustom(config);

    const loaded = ConfigManager.loadCustom();
    expect(loaded?.unitStyle).toBe(UnitStyle.Sprites);
  });

  it("should migrate old config without unitStyle to default", () => {
    const oldConfig = {
      mapWidth: 10,
      mapHeight: 10,
      spawnPointCount: 1,
      fogOfWarEnabled: true,
      debugOverlayEnabled: false,
      agentControlEnabled: true,
      mapGeneratorType: MapGeneratorType.Procedural,
      missionType: MissionType.Default,
      lastSeed: 12345,
      startingThreatLevel: 0,
      squadConfig: {
        soldiers: [{ archetypeId: "assault" }],
        inventory: {},
      },
    };

    localStorage.setItem("voidlock_custom_config", JSON.stringify(oldConfig));

    const loaded = ConfigManager.loadCustom();
    expect(loaded?.unitStyle).toBe(UnitStyle.TacticalIcons);
  });
});
