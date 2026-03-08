import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  AIProfile,
  EnemyType,
} from "@src/shared/types";

describe("Anti-Backtracking", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 1,
    cells: Array(10)
      .fill(null)
      .map((_, i) => ({
        x: i,
        y: 0,
        type: CellType.Floor,
      })),
    spawnPoints: [{ id: "s1", pos: { x: 1, y: 0 }, radius: 1 }],
    extraction: { x: 9, y: 0 },
  };

  let engine: CoreEngine;

  beforeEach(() => {
    engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [], inventory: {} },
      true, // agentControlEnabled = true
      true, // skipDeployment = true
    );
    engine.clearUnits();
    engine.clearEnemies();
  });

  it("SafetyBehavior should filter out recently visited cells from candidate waypoints", () => {
    // Set up a unit that has just moved from (2,0) to (1,0)
    // There's an enemy at (0,0)
    // The unit is in AVOID mode.
    // Neighbors of (1,0) are (0,0), (2,0), (1,1).
    // (0,0) is threatened.
    // (2,0) is recently visited.
    // (1,1) is the only good forward option.

    const unit = engine.addUnit({
      id: "u1",
      pos: { x: 5.5, y: 0.5 }, // Cell (5,0)
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
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      engagementPolicy: "AVOID",
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      positionHistory: [{ x: 6, y: 0 }], // Just came from (6,0)
      aiEnabled: true,
      innateMaxHp: 100,
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 0.5, y: 0.5 }, // Cell (0,0)
      hp: 50,
      maxHp: 50,
      type: EnemyType.XenoMite,
      damage: 10,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 1,
      speed: 2,
      difficulty: 1,
      state: UnitState.Idle,
    });

    // We need to make sure the unit has LOS to the enemy and knows about the cells.
    (engine as any).state.discoveredCells = Array(10).fill(0).map((_, i) => `${i},0`);
    // Mark (0,0) visible so the enemy is detected
    (engine as any).state.gridState[0 * mockMap.width + 0] |= 1;
    // Mark all as discovered in gridState
    for (let x = 0; x < 10; x++) {
        (engine as any).state.gridState[0 * mockMap.width + x] |= 2;
    }

    // Update engine to trigger AI re-evaluation
    engine.update(100);

    const updatedUnit = engine.getState().units[0];
    
    // It should have chosen (7,0) or further, but NOT (6,0)
    expect(updatedUnit.activePlan).toBeDefined();
    expect(updatedUnit.activePlan?.behavior).toBe("Kiting");
    
    const goal = updatedUnit.activePlan!.goal;
    const goalCell = { x: Math.floor(goal.x), y: Math.floor(goal.y) };
    
    console.log(`Unit u1 chose goal cell: (${goalCell.x}, ${goalCell.y})`);
    expect(goalCell).not.toEqual({ x: 6, y: 0 });
    expect(goalCell.x).toBeGreaterThan(6);
  });
});
