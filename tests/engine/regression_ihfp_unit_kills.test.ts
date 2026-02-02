import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { MapDefinition, MissionType, CellType } from "@src/shared/types";
import {
  createMockUnit,
  createMockEnemy,
} from "@src/engine/tests/utils/MockFactory";

describe("Regression IHFP: Unit Kill Tracking", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
    ],
    squadSpawn: { x: 0, y: 0 },
  };

  it("should increment unit.kills when a unit kills an enemy", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ archetypeId: "assault" }], inventory: {} },
      false, // agentControlEnabled
      false, // debugOverlayEnabled
      MissionType.Default,
    );

    engine.clearUnits();
    const unit = createMockUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      archetypeId: "test_archetype",
      stats: {
        damage: 100, // Insta-kill
        fireRate: 100,
        accuracy: 100,
        soldierAim: 100,
        attackRange: 5,
        speed: 10,
        equipmentAccuracyBonus: 0,
      },
    });
    engine.addUnit(unit);

    const enemy = createMockEnemy({
      id: "e1",
      pos: { x: 1.5, y: 0.5 },
      hp: 50,
    });
    engine.addEnemy(enemy);

    // Initial state
    expect(unit.kills).toBe(0);

    // Manually force attack if needed or let AI/Engagement policy handle it
    // In CoreEngine, units start with ENGAGE policy.

    // Update engine
    engine.update(100); // 100ms should be enough for one shot

    const state = engine.getState();
    const updatedUnit = state.units.find((u) => u.id === "u1")!;

    expect(updatedUnit.kills).toBe(1);
    expect(state.stats.aliensKilled).toBe(1);
  });
});
