import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { 
  CommandType, 
  UnitState, 
  MissionType
} from "@src/shared/types";

describe("Repro LXRDt: Recover Objective Pickup", () => {
  let engine: CoreEngine;

  const createMinimalMap = () => {
    const map = {
      width: 5,
      height: 5,
      cells: [] as any[],
      objectives: [
        {
          id: "artifact1",
          kind: "Recover" as const,
          targetCell: { x: 2, y: 2 },
          state: "Pending" as const,
          visible: true,
        }
      ],
      squadSpawn: { x: 1, y: 1 },
      boundaries: [],
    };

    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        map.cells.push({ x, y, type: "Floor" });
      }
    }
    return map;
  };

  it("should reproduce the 'Recovering (Idle)' hang when enemies are nearby", () => {
    const map = createMinimalMap();
    const squadConfig = {
      soldiers: [
        {
          id: "u1",
          archetypeId: "assault",
          rightHand: "pulse_rifle",
          leftHand: "combat_knife",
        }
      ],
      inventory: {}
    };
    
    engine = new CoreEngine(
      map as any,
      123,
      squadConfig as any,
      true, // agentControlEnabled
      false, // debugOverlayEnabled
      MissionType.Default
    );
    
    // Position unit at the objective
    const unit = engine.getState().units[0];
    unit.pos = { x: 2.5, y: 2.5 };
    unit.state = UnitState.Idle;
    unit.aiEnabled = true;

    // Add an enemy nearby to trigger combat
    engine.addEnemy({
      id: "e1",
      archetypeId: "drone",
      pos: { x: 2.7, y: 2.7 }, // Very close, should trigger combat
      hp: 1000,
      maxHp: 1000,
      stats: { speed: 0, aim: 0, vision: 10 },
      state: UnitState.Idle,
    } as any);

    // Initial state: ensure it has the PICKUP command
    engine.applyCommand({
      type: CommandType.PICKUP,
      unitIds: ["u1"],
      lootId: "artifact1",
      label: "Recovering"
    });

    // Run ticks
    for (let i = 0; i < 10; i++) {
      engine.update(100);
      const s = engine.getState().units[0];
      console.log(`Tick ${i}: State=${s.state}, Command=${s.activeCommand?.type}, Label=${s.activeCommand?.label}`);
    }

    const finalUnit = engine.getState().units[0];
    // This should now PASS because we allow Attacking state in InteractionBehavior
    expect(finalUnit.state).toBe(UnitState.Channeling);
  });

  it("should complete channeling and carry the objective", () => {
    const map = createMinimalMap();
    const squadConfig = {
      soldiers: [
        {
          id: "u1",
          archetypeId: "assault",
        }
      ],
      inventory: {}
    };
    
    engine = new CoreEngine(
      map as any,
      123,
      squadConfig as any,
      true, // agentControlEnabled
      false, // debugOverlayEnabled
      MissionType.Default
    );
    
    const unit = engine.getState().units[0];
    unit.pos = { x: 2.5, y: 2.5 };
    unit.state = UnitState.Idle;
    
    engine.applyCommand({
      type: CommandType.PICKUP,
      unitIds: ["u1"],
      lootId: "artifact1",
      label: "Recovering"
    });

    // Run one tick to start channeling
    engine.update(100);
    expect(engine.getState().units[0].state).toBe(UnitState.Channeling);

    // Run enough ticks to complete (BASE_COLLECT_TIME is 3000ms)
    for (let i = 0; i < 100; i++) {
      engine.update(100);
    }

    const finalUnit = engine.getState().units[0];
    expect(finalUnit.state).toBe(UnitState.Idle);
    expect(finalUnit.carriedObjectiveId).toBe("artifact1");
    
    const obj = engine.getState().objectives.find(o => o.id === "artifact1");
    expect(obj?.state).toBe("Pending");
  });
});
