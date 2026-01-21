import { describe, it, expect } from "vitest";
import { MapFactory } from "@src/engine/map/MapFactory";
import { MapGeneratorType, MapGenerationConfig } from "@src/shared/types";

describe("MapFactory Loot Generation", () => {
  it("should generate the requested number of bonus loot crates", () => {
    const config: MapGenerationConfig = {
      seed: 12345,
      width: 16,
      height: 16,
      type: MapGeneratorType.DenseShip,
      spawnPointCount: 3,
      bonusLootCount: 3,
    };

    const map = MapFactory.generate(config);
    
    expect(map.bonusLoot).toBeDefined();
    expect(map.bonusLoot?.length).toBe(3);
  });

  it("should not generate bonus loot if bonusLootCount is 0", () => {
    const config: MapGenerationConfig = {
      seed: 12345,
      width: 16,
      height: 16,
      type: MapGeneratorType.DenseShip,
      spawnPointCount: 3,
      bonusLootCount: 0,
    };

    const map = MapFactory.generate(config);
    
    expect(map.bonusLoot || []).toHaveLength(0);
  });

  it("should not exceed available room cells for bonus loot", () => {
    const config: MapGenerationConfig = {
      seed: 12345,
      width: 6,
      height: 6,
      type: MapGeneratorType.TreeShip,
      spawnPointCount: 1,
      bonusLootCount: 100, // Way more than cells available
    };

    const map = MapFactory.generate(config);
    
    // Should be capped by available room cells
    expect(map.bonusLoot?.length).toBeLessThan(100);
  });
});
