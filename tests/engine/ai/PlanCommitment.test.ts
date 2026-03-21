import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  SquadConfig,
  CommandType,
  UnitState,
  CellType,
} from "@src/shared/types";

describe("AI Plan Commitment", () => {
  let engine: CoreEngine;
  const map: MapDefinition = {
    width: 10,
    height: 10,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 0, y: 1, type: CellType.Floor },
      { x: 0, y: 2, type: CellType.Floor },
      { x: 0, y: 3, type: CellType.Floor },
      { x: 0, y: 4, type: CellType.Floor },
      { x: 0, y: 5, type: CellType.Floor },
      { x: 0, y: 6, type: CellType.Floor },
      { x: 0, y: 7, type: CellType.Floor },
      { x: 0, y: 8, type: CellType.Floor },
      { x: 0, y: 9, type: CellType.Floor },
      { x: 1, y: 9, type: CellType.Floor },
      { x: 2, y: 9, type: CellType.Floor },
      { x: 3, y: 9, type: CellType.Floor },
      { x: 4, y: 9, type: CellType.Floor },
      { x: 5, y: 9, type: CellType.Floor },
      { x: 6, y: 9, type: CellType.Floor },
      { x: 7, y: 9, type: CellType.Floor },
      { x: 8, y: 9, type: CellType.Floor },
      { x: 9, y: 9, type: CellType.Floor },
    ],
    spawnPoints: [{ id: "sp1", pos: { x: 0.5, y: 0.5 }, radius: 1 }],
    squadSpawns: [{ x: 0.5, y: 0.5 }],
    objectives: [
      {
        id: "obj1",
        kind: "Recover",
        targetCell: { x: 0, y: 9 },
      },
    ],
  };

  const squadConfig: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }],
    inventory: {},
  };

  beforeEach(() => {
    engine = new CoreEngine({
      map: map,
      seed: 123,
      squadConfig: squadConfig,
      agentControlEnabled: true,
      debugOverlayEnabled: false
    });
  });

  it("should set activePlan when ObjectiveBehavior issues a command", () => {
    const state = engine.getState();
    const unit = state.units[0];
    
    // Initial state: no plan
    expect(unit.activePlan).toBeUndefined();

    // Run a few ticks to let AI evaluate
    for (let i = 0; i < 20; i++) {
      engine.update(16);
    }

    const updatedState = engine.getState();
    const updatedUnit = updatedState.units[0];

    // It should have issued a PICKUP or MOVE_TO command for the objective
    expect(updatedUnit.activeCommand).toBeDefined();
    
    // CRITICAL: This is what we are implementing
    expect(updatedUnit.activePlan).toBeDefined();
    if (updatedUnit.activePlan) {
      expect(updatedUnit.activePlan.priority).toBe(3);
      expect(updatedUnit.activePlan.behavior).toMatch(/Recovering|Hunting|Extracting|Escorting/);
      // It should be state.t + 1000 (approx since some ticks passed)
      expect(updatedUnit.activePlan.committedUntil).toBeGreaterThanOrEqual(state.t + 1000);
      expect(updatedUnit.activePlan.committedUntil).toBeLessThanOrEqual(updatedState.t + 1000);
    }
  });

  it("should set activePlan when ExplorationBehavior issues a command", () => {
    // New engine with no objectives to force exploration
    const mapNoObj = { ...map, objectives: [] };
    const engineExploration = new CoreEngine({
      map: mapNoObj,
      seed: 123,
      squadConfig: squadConfig,
      agentControlEnabled: true,
      debugOverlayEnabled: false
    });
    
    const state = engineExploration.getState();
    const unit = state.units[0];
    
    expect(unit.activePlan).toBeUndefined();

    // Run a few ticks
    for (let i = 0; i < 20; i++) {
      engineExploration.update(16);
    }

    const updatedState = engineExploration.getState();
    const updatedUnit = updatedState.units[0];

    expect(updatedUnit.activeCommand?.label).toBe("Exploring");
    
    // CRITICAL: This is what we are implementing
    expect(updatedUnit.activePlan).toBeDefined();
    if (updatedUnit.activePlan) {
      expect(updatedUnit.activePlan.priority).toBe(4);
      expect(updatedUnit.activePlan.behavior).toBe("Exploring");
      expect(updatedUnit.activePlan.committedUntil).toBeGreaterThanOrEqual(state.t + 1000);
      expect(updatedUnit.activePlan.committedUntil).toBeLessThanOrEqual(updatedState.t + 1000);
    }
  });
});
