import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  CommandType,
  MapDefinition,
  CellType,
  UnitState,
} from "@src/shared/types";

describe("Item Targeting (voidlock-awkp)", () => {
  const mockMap: MapDefinition = {
    width: 5,
    height: 5,
    cells: [],
    squadSpawn: { x: 2, y: 2 },
  };
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor });
    }
  }

  it("Medkit should support targetUnitId and heal that unit", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      {
        soldiers: [
          { archetypeId: "assault", id: "unit-1" },
          { archetypeId: "medic", id: "unit-2" },
        ],
        inventory: { medkit: 1 },
      },
      false,
      false,
    );

    const state = engine.getState();
    const unit1 = state.units.find((u) => u.id === "unit-1")!;
    const unit2 = state.units.find((u) => u.id === "unit-2")!;

    unit2.hp = 10; // Injure unit 2

    // Unit 1 uses medkit on Unit 2
    const cmd: any = {
      type: CommandType.USE_ITEM,
      unitIds: ["unit-1"],
      itemId: "medkit",
      targetUnitId: "unit-2",
    };

    engine.applyCommand(cmd);

    // Medkit has channelTime: 2000ms.
    // Unit 1 should move to Unit 2 first if too far.
    // In this test they both spawn at {2,2} but might have slight jitter.

    // Advance time to complete channeling
    // Assault speed 20. Base 3000ms * (30/20) = 4500ms.
    engine.update(2000, 2000);
    engine.update(2000, 2000);
    engine.update(1000, 1000);

    const finalState = engine.getState();
    expect(finalState.units.find((u) => u.id === "unit-2")!.hp).toBeGreaterThan(
      10,
    );
    expect(finalState.squadInventory["medkit"]).toBe(0);
  });

  it("Grenade should support targetUnitId and damage that enemy", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      {
        soldiers: [{ archetypeId: "assault", id: "unit-1" }],
        inventory: { frag_grenade: 1 },
      },
      false,
      false,
    );

    // Manually add an enemy
    engine.addEnemy({
      id: "enemy-1",
      pos: { x: 3.5, y: 3.5 },
      hp: 100,
      maxHp: 100,
      type: "Warrior-Drone",
      damage: 10,
      fireRate: 1000,
      accuracy: 50,
      attackRange: 1,
      speed: 20,
    } as any);

    // Unit 1 uses grenade on enemy-1
    const cmd: any = {
      type: CommandType.USE_ITEM,
      unitIds: ["unit-1"],
      itemId: "frag_grenade",
      targetUnitId: "enemy-1",
    };

    engine.applyCommand(cmd);

    // Grenade is instant (channelTime: undefined)
    engine.update(100, 100);

    const finalState = engine.getState();
    expect(finalState.stats.aliensKilled).toBe(1);
    expect(finalState.squadInventory["frag_grenade"]).toBe(0);
  });
});
