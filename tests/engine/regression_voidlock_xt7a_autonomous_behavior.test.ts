import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  SquadConfig,
  AIProfile,
  EnemyType,
} from "@src/shared/types";

describe("Autonomous RUSH Behavior Regression", () => {
  let engine: CoreEngine;
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
    spawnPoints: [],
    extraction: { x: 9, y: 9 },
    objectives: [],
  };

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor });
    }
  }

  beforeEach(() => {
    const defaultSquad: SquadConfig = {
      soldiers: [{ archetypeId: "scout" }],
      inventory: {},
    };
    engine = new CoreEngine(mockMap, 123, defaultSquad, true, true); // agentControlEnabled = true
    engine.clearUnits();
  });

  it("RUSHing unit should move towards enemy autonomously", () => {
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
        attackRange: 2, // Short range
        speed: 200,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.RUSH,
      aiEnabled: true,
      commandQueue: [],
      archetypeId: "scout",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });

    // Add enemy out of range but visible.
    engine.addEnemy({
      id: "e1",
      type: EnemyType.XenoMite,
      pos: { x: 3.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      damage: 10,
      fireRate: 500,
      accuracy: 1000,
      attackRange: 2,
      speed: 0,
      difficulty: 1,
    });

    // Update. UnitAI should see enemy and issue MOVE_TO command via CombatBehavior
    engine.update(100);

    const state = engine.getState();
    const unit = state.units[0];

    // If CombatBehavior worked, the unit should now have an activeCommand and be moving
    expect(unit.activeCommand?.type).toBe(CommandType.MOVE_TO);
    expect(unit.state).toBe(UnitState.Moving);
  });
});
