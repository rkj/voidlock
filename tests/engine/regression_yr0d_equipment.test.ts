import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { MapDefinition, CellType, SquadConfig } from "@src/shared/types";

describe("Equipment System - Passive Buffs", () => {
  const mockMap: MapDefinition = {
    width: 3,
    height: 3,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 2, y: 0, type: CellType.Floor },
      { x: 0, y: 1, type: CellType.Floor },
      { x: 1, y: 1, type: CellType.Floor },
      { x: 2, y: 1, type: CellType.Floor },
      { x: 0, y: 2, type: CellType.Floor },
      { x: 1, y: 2, type: CellType.Floor },
      { x: 2, y: 2, type: CellType.Floor },
    ],
    squadSpawn: { x: 1, y: 1 },
  };

  it("should apply HP bonus from Heavy Plate Armor", () => {
    const squadConfig: SquadConfig = {
      soldiers: [
        {
          archetypeId: "assault",
          body: "heavy_plate",
        },
      ],
      inventory: {},
    };

    const engine = new CoreEngine(mockMap, 1, squadConfig, false, false);
    const unit = engine.getState().units[0];

    // Assault base HP is 100. Heavy Plate gives +100.
    expect(unit.hp).toBe(200);
    expect(unit.maxHp).toBe(200);
  });

  it("should apply Speed and Accuracy debuffs from Heavy Plate Armor", () => {
    const squadConfig: SquadConfig = {
      soldiers: [
        {
          archetypeId: "assault",
          body: "heavy_plate",
        },
      ],
      inventory: {},
    };

    const engine = new CoreEngine(mockMap, 1, squadConfig, false, false);
    const unit = engine.getState().units[0];

    // Assault base Speed: 20, Accuracy: 95.
    // Heavy Plate: Speed -5, Accuracy -10.
    expect(unit.stats.speed).toBe(15);
    expect(unit.stats.accuracy).toBe(85);
  });

  it("should apply Speed bonus from Combat Boots", () => {
    const squadConfig: SquadConfig = {
      soldiers: [
        {
          archetypeId: "assault",
          feet: "combat_boots",
        },
      ],
      inventory: {},
    };

    const engine = new CoreEngine(mockMap, 1, squadConfig, false, false);
    const unit = engine.getState().units[0];

    // Assault base Speed: 20. Combat Boots: Speed +5.
    expect(unit.stats.speed).toBe(25);
  });

  it("should apply multiple equipment bonuses", () => {
    const squadConfig: SquadConfig = {
      soldiers: [
        {
          archetypeId: "assault",
          body: "light_recon",
          feet: "combat_boots",
        },
      ],
      inventory: {},
    };

    const engine = new CoreEngine(mockMap, 1, squadConfig, false, false);
    const unit = engine.getState().units[0];

    // Assault: HP 100, Speed 20, Acc 95
    // Light Recon: HP +50, Speed +2
    // Combat Boots: Speed +5
    // Final: HP 150, Speed 27, Acc 95
    expect(unit.hp).toBe(150);
    expect(unit.stats.speed).toBe(27);
    expect(unit.stats.accuracy).toBe(95);
  });

  it("should apply active items to global squad inventory", () => {
    const squadConfig: SquadConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: { frag_grenade: 2, medkit: 1 },
    };

    const engine = new CoreEngine(mockMap, 1, squadConfig, false, false);
    const state = engine.getState();

    expect(state.squadInventory["frag_grenade"]).toBe(2);
    expect(state.squadInventory["medkit"]).toBe(1);
  });
});
