import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { MapGeneratorType } from "@src/shared/types";

describe("CampaignManager Advanced Rules (voidlock-a6i8)", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    CampaignManager.resetInstance();
    storage = new MockStorageProvider();
    manager = CampaignManager.getInstance(storage);
  });

  it("should support custom seed override", () => {
    const customSeed = 99999;
    manager.startNewCampaign(12345, "Normal", { customSeed });
    const state = manager.getState();

    expect(state?.seed).toBe(customSeed);
    // Verify nodes were generated with the custom seed (stable check)
    const nodeSeeds = state?.nodes.map(n => n.mapSeed);
    
    CampaignManager.resetInstance();
    const manager2 = CampaignManager.getInstance(new MockStorageProvider());
    manager2.startNewCampaign(54321, "Normal", { customSeed });
    const state2 = manager2.getState();
    expect(state2?.nodes.map(n => n.mapSeed)).toEqual(nodeSeeds);
  });

  it("should support map generator override", () => {
    manager.startNewCampaign(12345, "Normal", { mapGeneratorType: MapGeneratorType.TreeShip });
    expect(manager.getState()?.rules.mapGeneratorType).toBe(MapGeneratorType.TreeShip);
  });

  it("should support difficulty scaling override", () => {
    manager.startNewCampaign(12345, "Normal", { scaling: 1.5 });
    expect(manager.getState()?.rules.difficultyScaling).toBe(1.5);
  });

  it("should support resource scarcity override", () => {
    manager.startNewCampaign(12345, "Normal", { scarcity: 0.5 });
    expect(manager.getState()?.rules.resourceScarcity).toBe(0.5);
  });

  it("should support death rule override", () => {
    // Normal preset has "Clone" death rule
    manager.startNewCampaign(12345, "Normal", { deathRule: "Iron" });
    expect(manager.getState()?.rules.deathRule).toBe("Iron");
  });

  it("should support multiple overrides at once", () => {
    manager.startNewCampaign(12345, "Normal", {
      customSeed: 111,
      scaling: 2.0,
      scarcity: 0.1,
      deathRule: "Simulation",
      mapGeneratorType: MapGeneratorType.Procedural,
      startingScrap: 2000,
      mapGrowthRate: 0.5
    });

    const rules = manager.getState()?.rules;
    expect(rules?.customSeed).toBe(111);
    expect(rules?.difficultyScaling).toBe(2.0);
    expect(rules?.resourceScarcity).toBe(0.1);
    expect(rules?.deathRule).toBe("Simulation");
    expect(rules?.mapGeneratorType).toBe(MapGeneratorType.Procedural);
    expect(rules?.startingScrap).toBe(2000);
    expect(rules?.mapGrowthRate).toBe(0.5);
    expect(manager.getState()?.scrap).toBe(2000);
  });

  it("should maintain backward compatibility with legacy arguments", () => {
    // startNewCampaign(seed, difficulty, allowTacticalPause, themeId, unitStyle, mapGeneratorType, mapGrowthRate)
    manager.startNewCampaign(12345, "Normal", false, "industrial", undefined, MapGeneratorType.TreeShip, 0.8);
    
    const rules = manager.getState()?.rules;
    expect(rules?.allowTacticalPause).toBe(false);
    expect(rules?.themeId).toBe("industrial");
    expect(rules?.mapGeneratorType).toBe(MapGeneratorType.TreeShip);
    expect(rules?.mapGrowthRate).toBe(0.8);
  });
});
