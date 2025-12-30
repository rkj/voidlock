import { describe, it, expect } from "vitest";
import { CoreEngine } from "../CoreEngine";
import { MapDefinition, CellType, SquadConfig } from "../../shared/types";

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

  it("should apply HP bonus from Heavy Armor", () => {
    const squadConfig: SquadConfig = [
      {
        archetypeId: "assault",
        count: 1,
        equipment: { armorId: "heavy_armor" },
      },
    ];

    const engine = new CoreEngine(mockMap, 1, squadConfig, false, false);
    const unit = engine.getState().units[0];

    // Assault base HP is 100. Heavy Armor gives +150.
    expect(unit.hp).toBe(250);
    expect(unit.maxHp).toBe(250);
  });

  it("should apply Speed and Accuracy debuffs from Heavy Armor", () => {
    const squadConfig: SquadConfig = [
      {
        archetypeId: "assault",
        count: 1,
        equipment: { armorId: "heavy_armor" },
      },
    ];

    const engine = new CoreEngine(mockMap, 1, squadConfig, false, false);
    const unit = engine.getState().units[0];

    // Assault base Speed: 20, Accuracy: 95.
    // Heavy Armor: Speed -5, Accuracy -10.
    expect(unit.speed).toBe(15);
    expect(unit.accuracy).toBe(85);
  });

  it("should apply Speed bonus from Combat Shoes", () => {
    const squadConfig: SquadConfig = [
      {
        archetypeId: "assault",
        count: 1,
        equipment: { shoesId: "combat_shoes" },
      },
    ];

    const engine = new CoreEngine(mockMap, 1, squadConfig, false, false);
    const unit = engine.getState().units[0];

    // Assault base Speed: 20. Combat Shoes: Speed +5.
    expect(unit.speed).toBe(25);
  });

  it("should apply multiple equipment bonuses", () => {
    const squadConfig: SquadConfig = [
      {
        archetypeId: "assault",
        count: 1,
        equipment: {
          armorId: "light_armor",
          shoesId: "combat_shoes",
        },
      },
    ];

    const engine = new CoreEngine(mockMap, 1, squadConfig, false, false);
    const unit = engine.getState().units[0];

    // Assault: HP 100, Speed 20, Acc 95
    // Light Armor: HP +50, Speed -2
    // Combat Shoes: Speed +5
    // Final: HP 150, Speed 23, Acc 95
    expect(unit.hp).toBe(150);
    expect(unit.speed).toBe(23);
    expect(unit.accuracy).toBe(95);
  });

  it("should apply active item inventory and their potential passives", () => {
    const squadConfig: SquadConfig = [
      {
        archetypeId: "assault",
        count: 1,
        equipment: {
          itemIds: ["frag_grenade", "medkit"],
        },
      },
    ];

    const engine = new CoreEngine(mockMap, 1, squadConfig, false, false);
    const unit = engine.getState().units[0];

    expect(unit.equipment?.inventory.length).toBe(2);
    expect(unit.equipment?.inventory[0].itemId).toBe("frag_grenade");
    expect(unit.equipment?.inventory[0].charges).toBe(2);
    expect(unit.equipment?.inventory[1].itemId).toBe("medkit");
    expect(unit.equipment?.inventory[1].charges).toBe(1);
  });
});
