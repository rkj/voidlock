import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { CellType, SquadConfig, UnitState, CommandType, AIProfile } from "@src/shared/types";
import { MapDefinition } from "@src/shared/types";

describe("Immutable Update Integrity", () => {
  it("should not mutate previous state objects during update", () => {
    const mockMap: MapDefinition = {
      width: 5,
      height: 5,
      cells: [],
      spawnPoints: [],
      extraction: { x: 4, y: 4 },
      objectives: [],
    };
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        mockMap.cells.push({ x, y, type: CellType.Floor });
      }
    }

    const defaultSquad: SquadConfig = {
      soldiers: [{ archetypeId: "scout" }],
      inventory: {},
    };
    const engine = new CoreEngine(mockMap, 123, defaultSquad, false, false);
    engine.addUnit({
        id: "u1",
        pos: { x: 0.5, y: 0.5 },
        hp: 100,
        maxHp: 100,
        state: UnitState.Idle,
        stats: {
          damage: 20,
          fireRate: 500,
          accuracy: 1000,
          soldierAim: 100,
          attackRange: 5,
          speed: 200,
          equipmentAccuracyBonus: 0,
        },
        aiProfile: AIProfile.STAND_GROUND,
        commandQueue: [],
        archetypeId: "scout",
        kills: 0,
        damageDealt: 0,
        objectivesCompleted: 0,
      });

    const state1 = engine.getState(); // Snapshot 1
    const unit1 = state1.units.find(u => u.id === "u1")!;
    const initialPos = { ...unit1.pos };

    // Move unit
    engine.applyCommand({
        type: CommandType.MOVE_TO,
        unitIds: ["u1"],
        target: { x: 2, y: 0 },
    });

    // Run update
    engine.update(100);
    
    const state2 = engine.getState(); // Snapshot 2
    const unit2 = state2.units.find(u => u.id === "u1")!;
    
    // Check that unit2 moved
    expect(unit2.pos.x).toBeGreaterThan(initialPos.x);
    expect(unit2.state).toBe(UnitState.Moving);

    // Check that unit1 is UNTOUCHED
    expect(unit1.pos.x).toBe(initialPos.x);
    expect(unit1.state).toBe(UnitState.Idle); // Should still be idle in snapshot 1
    
    // Verify reference equality is broken
    expect(unit1).not.toBe(unit2);
  });
});
