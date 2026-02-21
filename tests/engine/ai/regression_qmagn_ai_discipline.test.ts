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

describe("AI Discipline (Extraction)", () => {
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

  it("Scenario A: Extraction Discipline - Unit should not be distracted by enemies", () => {
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
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
        speed: 1.0, // 1 cell per 1000ms (10 ticks)
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "scout",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });

    // Add an enemy at (5.5, 0.5)
    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 0.5 },
      hp: 1000, // Tanky so it doesn't die immediately
      maxHp: 1000,
      type: EnemyType.SwarmMelee,
      damage: 1,
      fireRate: 1000,
      accuracy: 1000,
      attackRange: 1,
      speed: 0,
      difficulty: 1,
    });

    // Order extraction
    engine.applyCommand({
      type: CommandType.EXTRACT,
      unitIds: ["u1"],
    });

    // Initially should be moving towards (9,0)
    engine.update(100); // 1 tick
    let state = engine.getState();
    let u1 = state.units[0];
    expect(u1.state).toBe(UnitState.Attacking); // It's attacking since enemy is in range
    expect(u1.activeCommand?.type).toBe(CommandType.EXTRACT);
    
    const initialPos = u1.pos.x;

    // Run for several ticks
    for(let i = 0; i < 20; i++) {
        engine.update(100);
        state = engine.getState();
        u1 = state.units[0];
        
        // Unit should keep moving towards extraction
        // Even if it sees the enemy and shoots at it.
        // If it stops to shoot, distance will stay same, which is a failure of discipline.
        expect(u1.activeCommand?.type).toBe(CommandType.EXTRACT, `Failed at tick ${i}`);
        expect(u1.state).toBe(UnitState.Attacking); // It can be attacking but MUST also be moving
    }

    const finalPos = u1.pos.x;
    expect(finalPos).toBeGreaterThan(initialPos);
  });
});
