import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  SquadConfig,
} from "../../../shared/types";

describe("Coordinated Exploration Refined", () => {
  let engine: CoreEngine;
  let map: MapDefinition;

  beforeEach(() => {
    // 10x10 Map
    map = {
      width: 10,
      height: 10,
      cells: [],
      spawnPoints: [],
      extraction: { x: 0, y: 0 },
      objectives: [
        {
          id: "obj1",
          kind: "Recover",
          targetCell: { x: 9, y: 9 },
          state: "Pending",
        }
      ],
    };

    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.cells.push({ x, y, type: CellType.Floor });
      }
    }

    const squad: SquadConfig = [];
    engine = new CoreEngine(map, 123, squad, true, false);
    engine.clearUnits();
  });

  it("should spread units to different areas of the map", () => {
    // Place 4 units at center
    for (let i = 0; i < 4; i++) {
      engine.addUnit({
        id: `u${i}`,
        pos: { x: 5.5, y: 5.5 },
        hp: 100,
        maxHp: 100,
        state: UnitState.Idle,
        damage: 10,
        fireRate: 100,
        attackRange: 5,
        sightRange: 0.1, 
        speed: 2,
        commandQueue: [],
      });
    }

    // Run update to trigger exploration target assignment
    engine.update(100);

    const state = engine.getState();
    const units = state.units;
    const targets = units.map(u => u.explorationTarget).filter(t => !!t);

    expect(targets.length).toBe(4);

    // Check that targets are sufficiently spread out
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        const dist = Math.sqrt(
          Math.pow(targets[i]!.x - targets[j]!.x, 2) +
          Math.pow(targets[i]!.y - targets[j]!.y, 2)
        );
        // With avoidRadius 5, they should be at least 3 tiles apart
        expect(dist).toBeGreaterThanOrEqual(3.0); 
      }
    }
  });

  it("should re-evaluate target if it becomes discovered by another unit", () => {
     engine.addUnit({
        id: "u1",
        pos: { x: 1.5, y: 1.5 },
        hp: 100,
        maxHp: 100,
        state: UnitState.Idle,
        damage: 10,
        fireRate: 100,
        attackRange: 5,
        sightRange: 0.1,
        speed: 2,
        commandQueue: [],
      });
      engine.addUnit({
        id: "u2",
        pos: { x: 8.5, y: 8.5 },
        hp: 100,
        maxHp: 100,
        state: UnitState.Idle,
        damage: 10,
        fireRate: 100,
        attackRange: 5,
        sightRange: 0.1,
        speed: 2,
        commandQueue: [],
      });

      engine.update(100);
      
      const units = engine.getState().units;
      const u1 = units.find(u => u.id === "u1")!;
      expect(u1.explorationTarget).toBeDefined();
      const target1 = { ...u1.explorationTarget! };
      
      // Manually discover u1's target in the engine's REAL state
      const key = `${Math.floor(target1.x)},${Math.floor(target1.y)}`;
      (engine as any).state.discoveredCells.push(key);
      
      // Run update again
      engine.update(100);
      
      const u1_after = engine.getState().units.find(u => u.id === "u1")!;
      if (u1_after.explorationTarget) {
          expect(u1_after.explorationTarget).not.toEqual(target1);
      }
  });
});