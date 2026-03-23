import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  AIProfile,
  EnemyType,
  Enemy,
  EnemyArchetypeLibrary,
} from "@src/shared/types";

describe("AI Plan Assignment", () => {
  const mockMap: MapDefinition = {
    width: 20,
    height: 10,
    cells: Array(200)
      .fill(null)
      .map((_, i) => ({
        x: i % 20,
        y: Math.floor(i / 20),
        type: CellType.Floor,
      })),
    spawnPoints: [{ id: "s1", pos: { x: 1, y: 1 }, radius: 1 }],
    extraction: { x: 19, y: 9 },
  };

  let engine: CoreEngine;

  beforeEach(() => {
    engine = new CoreEngine({
      map: mockMap,
      seed: 123,
      squadConfig: { soldiers: [], inventory: {} },
      agentControlEnabled: true,
      debugOverlayEnabled: false
    });
    engine.clearUnits();
    engine.clearEnemies();
  });

  const createEnemy = (pos: { x: number; y: number }): Enemy => {
    const arch = EnemyArchetypeLibrary[EnemyType.XenoMite];
    return {
      id: "e1",
      type: EnemyType.XenoMite,
      pos: pos,
      hp: arch.hp,
      maxHp: arch.hp,
      damage: arch.damage,
      fireRate: arch.fireRate,
      accuracy: arch.accuracy,
      attackRange: arch.attackRange,
      speed: arch.speed,
      difficulty: 1,
      state: UnitState.Idle,
    };
  };

  it("SafetyBehavior should set activePlan (Priority 0) when retreating due to low HP", () => {
    engine.addUnit({
      id: "u1",
      pos: { x: 1.5, y: 1.5 },
      hp: 10, // Low HP
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 1000,
        accuracy: 100,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 5,
        speed: 30,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0, objectivesCompleted: 0, positionHistory: [],
      aiEnabled: true,
      innateMaxHp: 100,
    });

    // Add an enemy IN THE SAME CELL to force it to move to another cell
    engine.addEnemy(createEnemy({ x: 1.6, y: 1.6 }));

    engine.update(100);

    const unit = engine.getState().units[0];
    expect(unit.activePlan).toBeDefined();
    expect(unit.activePlan?.behavior).toBe("Retreating");
    expect(unit.activePlan?.priority).toBe(0);
    expect(unit.activePlan?.committedUntil).toBeGreaterThan(0);
  });

  it("CombatBehavior should set activePlan (Priority 2) when Rushing", () => {
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
        speed: 30,
      },
      aiProfile: AIProfile.RUSH,
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0, objectivesCompleted: 0, positionHistory: [],
      aiEnabled: true,
      innateMaxHp: 100,
    });

    // Add an enemy far enough to trigger RUSH (dist > 1.5)
    engine.addEnemy(createEnemy({ x: 5.5, y: 1.5 }));

    engine.update(100);

    const unit = engine.getState().units[0];
    expect(unit.activePlan).toBeDefined();
    expect(unit.activePlan?.behavior).toBe("Rushing");
    expect(unit.activePlan?.priority).toBe(2);
    expect(unit.activePlan?.committedUntil).toBeGreaterThan(0);
  });

  it("CombatBehavior should set activePlan (Priority 2) when Engaging (Default Behavior)", () => {
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
        attackRange: 2, // Short range, but will be overwritten by assault profile (10)
        speed: 30,
      },
      aiProfile: "NONE" as any, // Falls through to default
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0, objectivesCompleted: 0, positionHistory: [],
      aiEnabled: true,
      innateMaxHp: 100,
    });

    // Add an enemy out of range (dist > 10)
    engine.addEnemy(createEnemy({ x: 15.5, y: 1.5 }));

    engine.update(100);

    const unit = engine.getState().units[0];
    expect(unit.activePlan).toBeDefined();
    expect(unit.activePlan?.behavior).toBe("Engaging");
    expect(unit.activePlan?.priority).toBe(2);
    expect(unit.activePlan?.committedUntil).toBeGreaterThan(0);
  });

  it("CombatBehavior should set activePlan (Priority 2) when Retreating (Combat Retreat)", () => {
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
        attackRange: 10,
        speed: 30,
      },
      aiProfile: AIProfile.RETREAT,
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0, objectivesCompleted: 0, positionHistory: [],
      aiEnabled: true,
      innateMaxHp: 100,
    });

    // Add an enemy very close (dist < 8)
    engine.addEnemy(createEnemy({ x: 2.5, y: 1.5 }));

    engine.update(100);

    const unit = engine.getState().units[0];
    expect(unit.activePlan).toBeDefined();
    expect(unit.activePlan?.behavior).toBe("Retreating");
    expect(unit.activePlan?.priority).toBe(2);
    expect(unit.activePlan?.committedUntil).toBeGreaterThan(0);
  });

  it("SafetyBehavior should set activePlan (Priority 0) when Kiting (AVOID mode)", () => {
    const unitPos = { x: 1.5, y: 1.5 };
    engine.addUnit({
      id: "u1",
      pos: unitPos,
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 1000,
        accuracy: 100,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 10,
        speed: 30,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      engagementPolicy: "AVOID",
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0, objectivesCompleted: 0, positionHistory: [],
      aiEnabled: true,
      innateMaxHp: 100,
    });

    // Add an enemy nearby (dist = 1.0)
    const enemyPos = { x: 2.5, y: 1.5 };
    engine.addEnemy(createEnemy(enemyPos));

    engine.update(100);

    const unit = engine.getState().units[0];
    expect(unit.activePlan).toBeDefined();
    expect(unit.activePlan?.behavior).toBe("Kiting");
    expect(unit.activePlan?.priority).toBe(0);
    expect(unit.activePlan?.committedUntil).toBeGreaterThan(0);

    // NEW: Verify it moves to a distant cell (>= 5 tiles away from threat)
    const goal = unit.activePlan!.goal;
    const distToThreat = Math.sqrt(
      Math.pow(goal.x - enemyPos.x, 2) + Math.pow(goal.y - enemyPos.y, 2),
    );
    expect(distToThreat).toBeGreaterThanOrEqual(5.0);
    
    // Also verify it's not just a neighbor of the original position (dist > 1.5)
    const distFromStart = Math.sqrt(
      Math.pow(goal.x - unitPos.x, 2) + Math.pow(goal.y - unitPos.y, 2),
    );
    expect(distFromStart).toBeGreaterThan(1.5);
  });

  it("SafetyBehavior should set activePlan (Priority 0) when Grouping Up (Isolated)", () => {
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
        attackRange: 10,
        speed: 30,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0, objectivesCompleted: 0, positionHistory: [],
      aiEnabled: true,
      innateMaxHp: 100,
    });

    // Add another unit far away (dist > 5)
    engine.addUnit({
      id: "u2",
      pos: { x: 8.5, y: 8.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 1000,
        accuracy: 100,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 10,
        speed: 30,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0, objectivesCompleted: 0, positionHistory: [],
      aiEnabled: true,
      innateMaxHp: 100,
    });

    engine.addEnemy(createEnemy({ x: 2.5, y: 1.5 }));

    engine.update(100);

    const unit = engine.getState().units[0];
    expect(unit.activePlan).toBeDefined();
    expect(unit.activePlan?.behavior).toBe("Grouping");
    expect(unit.activePlan?.priority).toBe(0);
    expect(unit.activePlan?.committedUntil).toBeGreaterThan(0);
  });
});
