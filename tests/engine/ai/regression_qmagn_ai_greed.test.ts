import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  AIProfile,
  CommandType,
} from "@src/shared/types";
import { Logger, LogLevel } from "@src/shared/Logger";

describe("AI Opportunism (Shiny Object)", () => {
  const roomMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: Array(25).fill(null).map((_, i) => ({
        x: i % 5,
        y: Math.floor(i / 5),
        type: CellType.Floor,
    })),
    objectives: [
        { id: "obj1", kind: "Recover", targetCell: { x: 2, y: 0 } }
    ],
    spawnPoints: [],
    extraction: { x: 4, y: 4 },
  };

  let engine: CoreEngine;

  beforeEach(() => {
    Logger.setLevel(LogLevel.DEBUG);
    engine = new CoreEngine({
      map: roomMap,
      seed: 123,
      squadConfig: { soldiers: [], inventory: {} },
      agentControlEnabled: true,
      debugOverlayEnabled: false
    });
    engine.clearUnits();
  });

  it("Scenario C: Shiny Object - Unit should deviate to pick up objective", () => {
    engine.addUnit({
        id: "u1",
        pos: { x: 0.5, y: 2.5 },
        hp: 100, maxHp: 100,
        innateMaxHp: 100,
        state: UnitState.Idle,
        stats: { damage: 10, fireRate: 100, accuracy: 1000, soldierAim: 90, equipmentAccuracyBonus: 0, attackRange: 10, speed: 1.0 },
        aiProfile: AIProfile.STAND_GROUND,
        commandQueue: [], 
        engagementPolicy: "ENGAGE", 
        archetypeId: "scout", 
        kills: 0, 
        damageDealt: 0, objectivesCompleted: 0, positionHistory: [], 
        aiEnabled: false, // Start with AI disabled to prevent early plan setting
    });

    // We want to explore towards (4, 2)
    // But objective is at (2, 0)
    
    // First, discover the room
    engine.update(100);
    
    // Start exploration (this enables AI)
    engine.applyCommand({ type: CommandType.EXPLORE, unitIds: ["u1"] });
    
    // Run for enough ticks to expire the commitment (1000ms)
    // The commitment starts when ObjectiveBehavior issues PICKUP in the first tick after EXPLORE.
    for(let i = 0; i < 15; i++) {
        engine.update(100);
    }
    
    const state = engine.getState();
    const u1 = state.units[0];
    
    // Unit should be targeting the objective at (2,0)
    expect(u1.activeCommand?.type).toBe(CommandType.PICKUP);
    expect(u1.activeCommand?.label).toBe("Recovering");
  });
});
