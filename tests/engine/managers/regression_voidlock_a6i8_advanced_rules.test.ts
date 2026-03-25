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
    manager.startNewCampaign(12345, "Standard", { customSeed });
    const state = manager.getState();

    // The campaign seed remains the original, but rules.customSeed is set
    expect(state?.seed).toBe(12345);
    expect(state?.rules.customSeed).toBe(customSeed);
    // Verify nodes were generated with the custom seed (stable check)
    const nodeIds = state?.nodes.map((n) => n.id);

    CampaignManager.resetInstance();
    const manager2 = CampaignManager.getInstance(new MockStorageProvider());
    manager2.startNewCampaign(54321, "Standard", { customSeed });
    const state2 = manager2.getState();
    // Same custom seed should produce the same map
    expect(state2?.nodes.map((n) => n.id)).toEqual(nodeIds);
  });

  it("should support map generator override", () => {
    manager.startNewCampaign(12345, "Standard", {
      mapGeneratorType: MapGeneratorType.TreeShip,
    });
    expect(manager.getState()?.rules.mapGeneratorType).toBe(
      MapGeneratorType.TreeShip,
    );
  });

  it("should support difficulty scaling override", () => {
    manager.startNewCampaign(12345, "Standard", { scaling: 1.5 });
    expect(manager.getState()?.rules.difficultyScaling).toBe(1.5);
  });

  it("should support resource scarcity override", () => {
    manager.startNewCampaign(12345, "Standard", { scarcity: 0.5 });
    expect(manager.getState()?.rules.resourceScarcity).toBe(0.5);
  });

  it("should support death rule override", () => {
    // Normal preset has "Clone" death rule
    manager.startNewCampaign(12345, "Standard", { deathRule: "Iron" });
    expect(manager.getState()?.rules.deathRule).toBe("Iron");
  });

  it("should support multiple overrides at once", () => {
    manager.startNewCampaign(12345, "Standard", {
      customSeed: 111,
      scaling: 2.0,
      scarcity: 0.1,
      deathRule: "Simulation",
      mapGeneratorType: MapGeneratorType.Procedural,
      startingScrap: 2000,
      mapGrowthRate: 0.5,
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

  it("should maintain backward compatibility with legacy arguments (simplified)", () => {
    // startNewCampaign(seed, difficulty, overrides, mapGeneratorType, mapGrowthRate)
    manager.startNewCampaign(
      12345,
      "Standard",
      { allowTacticalPause: false },
      MapGeneratorType.TreeShip,
      0.8,
    );

    const rules = manager.getState()?.rules;
    expect(rules?.allowTacticalPause).toBe(false);
    expect(rules?.mapGeneratorType).toBe(MapGeneratorType.TreeShip);
    expect(rules?.mapGrowthRate).toBe(0.8);
  });
});
