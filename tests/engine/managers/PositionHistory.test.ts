import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
} from "@src/shared/types";

describe("Unit Position History", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: Array(100)
      .fill(null)
      .map((_, i) => ({
        x: i % 10,
        y: Math.floor(i / 10),
        type: CellType.Floor,
      })),
    spawnPoints: [{ id: "s1", pos: { x: 1, y: 1 }, radius: 1 }],
    extraction: { x: 9, y: 9 },
  };

  let engine: CoreEngine;

  const getUnit = () => engine.getState().units[0];

  beforeEach(() => {
    engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [], inventory: {} },
      true,
      true, // skipDeployment = true
    );
    engine.clearUnits();
  });

  it("should record cell positions in positionHistory when moving", () => {
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 1000,
        accuracy: 100,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 5,
        speed: 30, // Default assault speed is 20, but we can try to force 30
      },
      aiProfile: "NONE" as any,
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0, objectivesCompleted: 0, positionHistory: [],
      objectivesCompleted: 0,
    });

    // Move across several cells
    engine.applyCommand({
      type: "MOVE_TO" as any,
      unitIds: ["u1"],
      target: { x: 8, y: 0 }
    });

    // Update until it reaches (1,0)
    for (let i = 0; i < 50; i++) {
        engine.update(100);
        if (Math.floor(getUnit().pos.x) === 1) break;
    }
    expect(getUnit().positionHistory).toContainEqual({ x: 1, y: 0 });

    // Update until it reaches (8,0) or ring buffer fills up
    for (let i = 0; i < 500; i++) {
        engine.update(100);
        if (Math.floor(getUnit().pos.x) === 8) break;
    }

    const unit = getUnit();
    const coords = unit.positionHistory.map(c => `${c.x},${c.y}`);
    
    // Check ring buffer limit (max 6)
    expect(unit.positionHistory.length).toBe(6);
    
    // Last cell should be in history
    expect(coords).toContain("8,0");
    
    // Earliest cells should have been pushed out
    expect(coords).not.toContain("1,0");
    expect(coords).not.toContain("2,0");
  });
});
