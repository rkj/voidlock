import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  CommandType,
  MapDefinition,
  CellType,
} from "@src/shared/types";

describe("Grenade Command Behavior", () => {
  const mockMap: MapDefinition = {
    width: 20,
    height: 20,
    cells: [],
    squadSpawn: { x: 2, y: 2 },
  };
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor });
    }
  }

  it("should damage only entities in the exact same cell (regression test for voidlock-4rxw)", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      {
        soldiers: [
          { archetypeId: "assault", id: "unit-1" },
          { archetypeId: "scout", id: "unit-2" },
        ],
        inventory: { frag_grenade: 1 },
      },
      false,
      false,
    );

    // Access private state for testing purposes
    const state = (engine as any).state;

    // Disable unit damage to prevent interference
    state.units.forEach((u: any) => (u.stats.damage = 0));

    // Target enemy at (3.2, 3.8) -> Cell (3,3)
    engine.addEnemy({
      id: "target-enemy",
      pos: { x: 3.2, y: 3.8 },
      hp: 100,
      maxHp: 100,
      type: "warrior-drone",
      damage: 10,
      fireRate: 1000,
      accuracy: 50,
      attackRange: 1,
      speed: 20,
    } as any);

    // Another enemy in the same cell (3,3)
    engine.addEnemy({
      id: "collateral-enemy",
      pos: { x: 3.8, y: 3.2 },
      hp: 100,
      maxHp: 100,
      type: "warrior-drone",
      damage: 10,
      fireRate: 1000,
      accuracy: 50,
      attackRange: 1,
      speed: 20,
    } as any);

    // Enemy in distant cell (15.5, 15.5) -> Cell (15,15)
    engine.addEnemy({
      id: "safe-enemy",
      pos: { x: 15.5, y: 15.5 },
      hp: 100,
      maxHp: 100,
      type: "warrior-drone",
      damage: 10,
      fireRate: 1000,
      accuracy: 50,
      attackRange: 1,
      speed: 20,
    } as any);

    const unit2 = state.units.find((u: any) => u.id === "unit-2")!;
    unit2.pos = { x: 3.5, y: 3.5 };

    const unit1 = state.units.find((u: any) => u.id === "unit-1")!;
    unit1.pos = { x: 0.5, y: 0.5 };

    // Use grenade on target-enemy
    engine.applyCommand({
      type: CommandType.USE_ITEM,
      unitIds: ["unit-1"],
      itemId: "frag_grenade",
      targetUnitId: "target-enemy",
    });

    engine.update(100);

    const finalState = engine.getState();
    const targetEnemy = finalState.enemies.find((e) => e.id === "target-enemy");
    const collateralEnemy = finalState.enemies.find(
      (e) => e.id === "collateral-enemy",
    );
    const safeEnemy = finalState.enemies.find((e) => e.id === "safe-enemy")!;
    const unit2Final = finalState.units.find((u) => u.id === "unit-2")!;
    const unit1Final = finalState.units.find((u) => u.id === "unit-1")!;

    expect(targetEnemy ? targetEnemy.hp : 0).toBeLessThan(100);
    expect(collateralEnemy ? collateralEnemy.hp : 0).toBeLessThan(100);
    expect(safeEnemy.hp).toBe(100);
    expect(unit2Final.hp).toBeLessThan(unit2Final.maxHp);
    expect(unit1Final.hp).toBe(unit1Final.maxHp);
  });
});
