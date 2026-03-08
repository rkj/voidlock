import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  EnemyType,
  AIProfile,
} from "@src/shared/types";

describe("AI Commitment Guard", () => {
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

  beforeEach(() => {
    engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [], inventory: {} },
      true, // agentControlEnabled = true
      false,
    );
    engine.clearUnits();
  });

  it("should skip lower priority behaviors if a committed plan is active", () => {
    // 1. Add a unit that would normally want to EXPLORE (Priority 4)
    engine.addUnit({
      id: "u1",
      pos: { x: 1.5, y: 1.5 },
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
      engagementPolicy: "ENGAGE",
      archetypeId: "test",
      kills: 0,
      damageDealt: 0, objectivesCompleted: 0, positionHistory: [],
      aiEnabled: true,
    });

    // 2. Manually inject an activePlan with priority 2 (Combat-level)
    // and set it to expire in the future.
    const u1 = (engine as any).state.units[0];
    u1.activePlan = {
      behavior: "TestPlan",
      goal: { x: 1.5, y: 1.5 }, // Stay here
      committedUntil: (engine as any).state.t + 5000,
      priority: 2, // Combat priority
    };
    // Also clear any path to ensure it's not moving
    u1.state = UnitState.Idle;
    u1.path = undefined;
    u1.targetPos = undefined;

    // 3. Update. Normally, Exploration (Priority 4) would trigger because it's idle.
    engine.update(100);

    // 4. Verify it's STILL Idle and hasn't picked up an Exploration target
    const updatedState = engine.getState();
    const updatedU1 = updatedState.units[0];
    
    expect(updatedU1.state).toBe(UnitState.Idle);
    expect(updatedU1.explorationTarget).toBeUndefined();
    expect(updatedU1.activePlan?.behavior).toBe("TestPlan");
  });

  it("should ALLOW higher priority behaviors even if a committed plan is active", () => {
    // 1. Add a unit that is AT extraction point and at LOW HP
    engine.addUnit({
      id: "u1",
      pos: { x: 9.5, y: 9.5 }, // Extraction point is (9, 9)
      hp: 10,
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
      engagementPolicy: "ENGAGE",
      archetypeId: "test",
      kills: 0,
      damageDealt: 0, objectivesCompleted: 0, positionHistory: [],
      aiEnabled: true,
    });

    // 2. Manually inject an activePlan with priority 3 (Objective-level)
    const u1 = (engine as any).state.units[0];
    u1.activePlan = {
      behavior: "TestPlan",
      goal: { x: 9.5, y: 9.5 },
      committedUntil: (engine as any).state.t + 5000,
      priority: 3, // Objective priority
    };

    // 3. Update. Interaction (Priority 1) should interrupt Objective (Priority 3).
    engine.update(100);

    // 4. Verify it HAS interrupted (state should be Channeling)
    const updatedState = engine.getState();
    const updatedU1 = updatedState.units[0];
    
    expect(updatedU1.state).toBe(UnitState.Channeling);
    expect(updatedU1.channeling?.action).toBe("Extract");
  });
});
