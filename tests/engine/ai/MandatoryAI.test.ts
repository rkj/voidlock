import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  EnemyType,
  CommandType,
  AIProfile,
} from "@src/shared/types";
import { MathUtils } from "@src/shared/utils/MathUtils";

describe("Mandatory AI Scenarios (ADR 0041)", () => {
  // A. Extraction Discipline
  it("Extraction Discipline: unit with EXTRACT command stays focused on extraction even when attacked", () => {
    // Map: 10x1 Corridor. Unit at (1,0), Extraction at (9,0). Enemy at (0,0).
    const map: MapDefinition = {
      width: 10,
      height: 1,
      cells: Array(10).fill(null).map((_, i) => ({
        x: i,
        y: 0,
        type: CellType.Floor,
      })),
      spawnPoints: [],
      extraction: { x: 9, y: 0 },
    };

    const engine = new CoreEngine(map, 123, { soldiers: [], inventory: {} }, true, false);
    engine.clearUnits();

    engine.addUnit({
      id: "u1",
      pos: { x: 1.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 1000,
        accuracy: 1000,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 5,
        speed: 30, // 1 cell/sec
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "test",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      aiEnabled: true,
    });

    // Issue EXTRACT command
    engine.applyCommand({
      type: CommandType.EXTRACT,
      unitIds: ["u1"],
    });

    // Spawn enemy at (0.5, 0.5) - behind the unit
    engine.addEnemy({
      id: "e1",
      pos: { x: 0.5, y: 0.5 },
      hp: 50,
      maxHp: 50,
      type: EnemyType.SwarmMelee,
      damage: 10,
      fireRate: 100,
      accuracy: 1000,
      attackRange: 1,
      speed: 1,
      difficulty: 1,
    });

    const initialDist = MathUtils.getDistance({x:1.5, y:0.5}, {x:9.5, y:0.5});
    let lastDist = initialDist;

    // Run for 5 seconds
    for (let i = 0; i < 50; i++) {
      engine.update(100);
      const u1 = engine.getState().units[0];
      const currentDist = MathUtils.getDistance(u1.pos, {x:9.5, y:0.5});
      
      // Distance to Extraction decreases monotonically
      expect(currentDist).toBeLessThanOrEqual(lastDist + 0.001);
      
      // Unit does NOT switch to ATTACK or IDLE
      expect(u1.state).not.toBe(UnitState.Attacking);
      expect(u1.state).not.toBe(UnitState.Idle);
      
      lastDist = currentDist;
    }
    
    const finalDist = MathUtils.getDistance(engine.getState().units[0].pos, {x:9.5, y:0.5});
    expect(finalDist).toBeLessThan(initialDist);
  });

  // B. Coordinated Split
  it("Coordinated Split: two units target different rooms in a Y-junction", () => {
    // Map: Y-junction with walls blocking LOS between branches.
    const map: MapDefinition = {
      width: 10,
      height: 10,
      cells: [
        {x: 0, y: 5, type: CellType.Floor}, {x: 1, y: 5, type: CellType.Floor}, {x: 2, y: 5, type: CellType.Floor},
        {x: 3, y: 5, type: CellType.Floor}, // Junction
        {x: 3, y: 4, type: CellType.Floor}, {x: 3, y: 3, type: CellType.Floor}, {x: 4, y: 3, type: CellType.Floor}, // Branch A
        {x: 3, y: 6, type: CellType.Floor}, {x: 3, y: 7, type: CellType.Floor}, {x: 4, y: 7, type: CellType.Floor}, // Branch B
      ],
      spawnPoints: [],
      extraction: { x: 0, y: 5 },
    };

    const engine = new CoreEngine(map, 123, { soldiers: [], inventory: {} }, true, false);
    engine.clearUnits();

    engine.addUnit({
      id: "u1", pos: { x: 0.5, y: 5.5 }, hp: 100, maxHp: 100, state: UnitState.Idle,
      stats: { damage: 10, fireRate: 1000, accuracy: 1000, soldierAim: 90, speed: 30 },
      commandQueue: [], archetypeId: "test", aiEnabled: true, aiProfile: AIProfile.STAND_GROUND,
    });
    engine.addUnit({
      id: "u2", pos: { x: 1.5, y: 5.5 }, hp: 100, maxHp: 100, state: UnitState.Idle,
      stats: { damage: 10, fireRate: 1000, accuracy: 1000, soldierAim: 90, speed: 30 },
      commandQueue: [], archetypeId: "test", aiEnabled: true, aiProfile: AIProfile.STAND_GROUND,
    });

    // Start exploration
    engine.applyCommand({ type: CommandType.EXPLORE, unitIds: ["u1", "u2"] });

    // Update until they find targets
    let u1Found = false;
    let u2Found = false;
    for (let i = 0; i < 50; i++) {
      engine.update(100);
      const state = engine.getState();
      const u1 = state.units.find(u => u.id === "u1")!;
      const u2 = state.units.find(u => u.id === "u2")!;
      if (u1.explorationTarget) u1Found = true;
      if (u2.explorationTarget) u2Found = true;
      if (u1Found && u2Found) break;
    }

    const state = engine.getState();
    const u1 = state.units.find(u => u.id === "u1")!;
    const u2 = state.units.find(u => u.id === "u2")!;

    expect(u1.explorationTarget).toBeDefined();
    expect(u2.explorationTarget).toBeDefined();
    // They should have partitioned the Y-junction
    expect(u1.explorationTarget!.y).not.toEqual(u2.explorationTarget!.y);
  });

  // C. Opportunistic Greed
  it("Opportunistic Greed: unit deviates to pick up objective off the optimal path", () => {
    // Map: 10x10 Room.
    const map: MapDefinition = {
      width: 10,
      height: 10,
      cells: Array(100).fill(null).map((_, i) => ({
        x: i % 10,
        y: Math.floor(i / 10),
        type: CellType.Floor,
      })),
      spawnPoints: [],
      extraction: { x: 9, y: 9 },
      objectives: [{ id: "obj1", kind: "Recover", targetCell: { x: 5, y: 0 }, state: "Pending", visible: true }],
    };

    const engine = new CoreEngine(map, 123, { soldiers: [], inventory: {} }, true, false);
    engine.clearUnits();

    engine.addUnit({
      id: "u1", pos: { x: 0.5, y: 5.5 }, hp: 100, maxHp: 100, state: UnitState.Idle,
      stats: { damage: 10, fireRate: 1000, accuracy: 1000, soldierAim: 90, speed: 60 }, // 2 cells/sec
      commandQueue: [], archetypeId: "test", aiEnabled: true, aiProfile: AIProfile.STAND_GROUND,
    });

    // Start exploration
    engine.applyCommand({ type: CommandType.EXPLORE, unitIds: ["u1"] });

    let pickedUp = false;
    for (let i = 0; i < 200; i++) {
      engine.update(100);
      const state = engine.getState();
      const obj = state.objectives![0];
      
      if (obj.state === "Completed") {
        pickedUp = true;
        break;
      }
    }

    expect(pickedUp).toBe(true);
  });

  // D. Efficiency Ratio
  it("Efficiency Ratio: Ratio = UniqueCellsDiscovered / TotalStepsTaken is efficient", () => {
    // 5x5 Grid.
    const map: MapDefinition = {
      width: 5,
      height: 5,
      cells: Array(25).fill(null).map((_, i) => ({
        x: i % 5,
        y: Math.floor(i / 5),
        type: CellType.Floor,
      })),
      // Add walls to force exploration
      walls: [
        {p1: {x: 0, y: 1}, p2: {x: 4, y: 1}},
        {p1: {x: 1, y: 2}, p2: {x: 5, y: 2}},
      ],
      spawnPoints: [],
      extraction: { x: 4, y: 4 }, // Far from start
    };

    const engine = new CoreEngine(map, 123, { soldiers: [], inventory: {} }, true, false);
    engine.clearUnits();

    engine.addUnit({
      id: "u1", pos: { x: 0.5, y: 0.5 }, hp: 100, maxHp: 100, state: UnitState.Idle,
      stats: { damage: 10, fireRate: 1000, accuracy: 1000, soldierAim: 90, speed: 60 },
      commandQueue: [], archetypeId: "test", aiEnabled: true, aiProfile: AIProfile.STAND_GROUND,
    });

    engine.applyCommand({ type: CommandType.EXPLORE, unitIds: ["u1"] });

    let totalSteps = 0;
    let lastPos = { x: 0.5, y: 0.5 };
    
    for (let i = 0; i < 1000; i++) {
      engine.update(100);
      const state = engine.getState();
      const u1 = state.units[0];
      totalSteps += MathUtils.getDistance(u1.pos, lastPos);
      lastPos = { ...u1.pos };
      
      if (state.discoveredCells.length >= 25) break;
    }

    const state = engine.getState();
    const discoveredCount = state.discoveredCells.length;
    const ratio = totalSteps > 0 ? discoveredCount / totalSteps : 0;
    
    expect(discoveredCount).toBe(25);
    expect(ratio).toBeGreaterThan(0.3); // Ratio might be lower with walls
  });
});
