import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  EnemyType,
  AIProfile,
  CommandType,
} from "@src/shared/types";

describe("AI Discipline (Extraction) - RUSH Repro", () => {
  const corridorMap: MapDefinition = {
    width: 10,
    height: 1,
    cells: Array(10)
      .fill(null)
      .map((_, i) => ({
        x: i,
        y: 0,
        type: CellType.Floor,
      })),
    spawnPoints: [],
    extraction: { x: 9, y: 0 },
  };

  let engine: CoreEngine;

  beforeEach(() => {
    engine = new CoreEngine(
      corridorMap,
      123,
      { soldiers: [], inventory: {} },
      true,
      false,
    );
    engine.clearUnits();
  });

  it("Scenario A: Extraction Discipline - RUSH unit should NOT turn back to fight", () => {
    engine.addUnit({
      id: "u1",
      pos: { x: 2.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 100,
        accuracy: 1000,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 10,
        speed: 1.0, 
      },
      aiProfile: AIProfile.RUSH, // RUSH will try to close distance to enemy
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });

    // Add an enemy BEHIND the unit (at 0.5, 0.5)
    engine.addEnemy({
      id: "e1",
      pos: { x: 0.5, y: 0.5 },
      hp: 1000,
      maxHp: 1000,
      type: EnemyType.SwarmMelee,
      damage: 1,
      fireRate: 1000,
      accuracy: 1000,
      attackRange: 1,
      speed: 0,
      difficulty: 1,
    });

    // Order extraction (to 9,0)
    engine.applyCommand({
      type: CommandType.EXTRACT,
      unitIds: ["u1"],
    });
    
    // Manually re-enable AI to simulate AI-driven extraction
    engine.getState().units[0].aiEnabled = true;

    // Initially should be moving towards (9,0)
    engine.update(100); 
    let state = engine.getState();
    let u1 = state.units[0];
    
    console.log(`Initial Pos: ${u1.pos.x}, State: ${u1.state}, Command: ${u1.activeCommand?.type}`);
    const initialPos = u1.pos.x;
    expect(u1.activeCommand?.type).toBe(CommandType.EXTRACT);

    // Run for several ticks
    for(let i = 0; i < 10; i++) {
        engine.update(100);
        state = engine.getState();
        u1 = state.units[0];
        console.log(`Tick ${i}, Pos: ${u1.pos.x}, State: ${u1.state}, Command: ${u1.activeCommand?.type}`);
        
        // Unit should keep moving towards extraction (increasing x)
        // If it rushes the enemy at x=0, its x will decrease.
        expect(u1.activeCommand?.type).toBe(CommandType.EXTRACT, `Failed at tick ${i}: command was overwritten by ${u1.activeCommand?.type}`);
    }

    const finalPos = u1.pos.x;
    expect(finalPos).toBeGreaterThan(initialPos, "Unit moved towards enemy instead of extraction!");
  });
});
