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

describe("AI Oscillation and Plan Commitment (voidlock-2m8oi.8)", () => {
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
    engine = new CoreEngine({
      map: mockMap,
      seed: 123,
      squadConfig: { soldiers: [], inventory: {} },
      agentControlEnabled: true,
      debugOverlayEnabled: true,
      missionType: undefined
    });
    engine.clearUnits();
    engine.clearEnemies();
  });

  it("1) Kiting unit in a corridor does not revisit the same cell within 6 ticks (oscillation check)", () => {
    // 1x10 corridor
    const corridorMap: MapDefinition = {
      width: 10,
      height: 1,
      cells: Array(10).fill(null).map((_, i) => ({ x: i, y: 0, type: CellType.Floor })),
      spawnPoints: [{ id: "s1", pos: { x: 0, y: 0 }, radius: 1 }],
      extraction: { x: 9, y: 0 },
    };
    engine = new CoreEngine({
      map: corridorMap,
      seed: 123,
      squadConfig: { soldiers: [], inventory: {} },
      agentControlEnabled: true,
      debugOverlayEnabled: true
    });
    engine.clearUnits();

    // Unit at (2,0), Enemy at (1,0). Engagement: AVOID.
    engine.addUnit({
      id: "u1",
      pos: { x: 2.5, y: 0.5 },
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
        speed: 50, // High speed to move across cells quickly
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      engagementPolicy: "AVOID",
      archetypeId: "test",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      positionHistory: [],
      aiEnabled: true,
      innateMaxHp: 100,
    });

    engine.addEnemy({
      id: "e1",
      type: EnemyType.XenoMite,
      pos: { x: 1.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 1,
      speed: 0, // Stationary enemy
      difficulty: 1,
    });

    // Mark cells as discovered/visible
    const internalState = (engine as any).state;
    for (let x = 0; x < 10; x++) {
      internalState.discoveredCells.push(`${x},0`);
      internalState.gridState[x] |= 3; // discovered + visible
    }

    // Tick until unit moves as far as possible
    let history: string[] = [];
    for (let i = 0; i < 200; i++) {
      engine.update(16);
      const u = engine.getState().units[0];
      const cell = `${Math.floor(u.pos.x)},${Math.floor(u.pos.y)}`;
      if (history.length === 0 || history[history.length - 1] !== cell) {
        history.push(cell);
      }
      if (cell === "9,0") break;
    }

    expect(history).toContain("3,0");
    expect(history.length).toBeGreaterThan(5);
    
    // Sliding window check: no cell is revisited within a sliding window of 6 positions.
    // For any index i, history[i] != history[j] for j in [i+1, i+5].
    for (let i = 0; i < history.length; i++) {
      for (let j = i + 1; j <= i + 5 && j < history.length; j++) {
        expect(history[i], `Cell ${history[i]} revisited at index ${j} within window of 6 (History: ${history.join(" -> ")})`).not.toBe(history[j]);
      }
    }
  });

  it("2) Exploring unit follows its full path without reversing direction when no trigger fires", () => {
    // 10x10 L-shaped corridor
    const lMap: MapDefinition = {
      width: 10,
      height: 10,
      cells: [
        ...Array(10).fill(null).map((_, i) => ({ x: i, y: 0, type: CellType.Floor })),
        ...Array(9).fill(null).map((_, i) => ({ x: 9, y: i + 1, type: CellType.Floor })),
      ],
      spawnPoints: [{ id: "s1", pos: { x: 0, y: 0 }, radius: 1 }],
    };
    engine = new CoreEngine({
      map: lMap,
      seed: 123,
      squadConfig: { soldiers: [], inventory: {} },
      agentControlEnabled: true,
      debugOverlayEnabled: true
    });
    engine.clearUnits();

    // Unit at (0,0), Target at (9,9)
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
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "test",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      positionHistory: [],
      aiEnabled: true,
      innateMaxHp: 100,
    });

    const internalState = (engine as any).state;
    internalState.discoveredCells = [];
    for (let i = 0; i < internalState.gridState.length; i++) internalState.gridState[i] = 0;

    // Discover everything except (9,9)
    lMap.cells.forEach(c => {
      if (c.x === 9 && c.y === 9) return;
      internalState.discoveredCells.push(`${c.x},${c.y}`);
      internalState.gridState[c.y * 10 + c.x] |= 2; 
    });

    engine.update(16);
    let unit = engine.getState().units[0];
    expect(unit.activePlan?.behavior).toBe("Exploring");
    expect(unit.activePlan?.goal).toEqual({ x: 9.5, y: 9.5 });
    const initialPlanGoal = unit.activePlan!.goal;

    // Tick and verify it keeps the same goal and moves along the path
    let lastDist = 100;
    for (let i = 0; i < 20; i++) {
      engine.update(100); 
      unit = engine.getState().units[0];
      expect(unit.activePlan?.goal).toEqual(initialPlanGoal);
      const dist = Math.sqrt(Math.pow(unit.pos.x - 9.5, 2) + Math.pow(unit.pos.y - 9.5, 2));
      expect(dist).toBeLessThan(lastDist);
      lastDist = dist;
    }
  });

  it("3) Combat behavior cannot override another combat plan mid-execution (priority lock)", () => {
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
      aiProfile: AIProfile.RUSH,
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "test",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      positionHistory: [],
      aiEnabled: true,
      innateMaxHp: 100,
    });

    // Enemy at (5, 5) triggers Rushing (Priority 2)
    engine.addEnemy({
      id: "e1",
      type: EnemyType.XenoMite,
      pos: { x: 5.5, y: 5.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 1,
      speed: 0,
      difficulty: 1,
    });

    engine.update(16);
    let unit = engine.getState().units[0];
    expect(unit.activePlan?.behavior).toBe("Rushing");
    expect(unit.activePlan?.priority).toBe(2);
    const originalPlan = unit.activePlan;

    // Change profile to RETREAT. Normally it would want to "Retreating" (also Priority 2)
    // but it should stay on "Rushing" because it's committed.
    // Use an immutable-style update to change the state cleanly.
    const internalState = (engine as any).state;
    internalState.units[0] = { ...internalState.units[0], aiProfile: AIProfile.RETREAT };
    
    engine.update(16);
    unit = engine.getState().units[0];
    expect(unit.activePlan?.behavior).toBe("Rushing"); // Still rushing
    expect(unit.activePlan?.committedUntil).toBe(originalPlan?.committedUntil);
  });

  it("4) Invalidation trigger (new enemy in LOS) correctly causes plan re-evaluation", () => {
    // 10x10 L-shaped corridor
    const lMap: MapDefinition = {
      width: 10,
      height: 10,
      cells: [
        ...Array(10).fill(null).map((_, i) => ({ x: i, y: 0, type: CellType.Floor })),
        ...Array(9).fill(null).map((_, i) => ({ x: 9, y: i + 1, type: CellType.Floor })),
      ],
      spawnPoints: [{ id: "s1", pos: { x: 0, y: 0 }, radius: 1 }],
    };
    engine = new CoreEngine({
      map: lMap,
      seed: 123,
      squadConfig: { soldiers: [], inventory: {} },
      agentControlEnabled: true,
      debugOverlayEnabled: true
    });
    engine.clearUnits();

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
        attackRange: 10,
        speed: 20,
      },
      aiProfile: AIProfile.RUSH,
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "test",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      positionHistory: [],
      aiEnabled: true,
      innateMaxHp: 100,
    });

    const internalState = (engine as any).state;
    internalState.discoveredCells = [];
    for (let i = 0; i < internalState.gridState.length; i++) internalState.gridState[i] = 0;

    lMap.cells.forEach(c => {
      if (c.x === 9 && c.y === 9) return;
      internalState.discoveredCells.push(`${c.x},${c.y}`);
      internalState.gridState[c.y * 10 + c.x] |= 2; 
    });

    engine.update(16);
    let unit = engine.getState().units[0];
    expect(unit.activePlan?.behavior).toBe("Exploring");

    // Spawn enemy in LOS (dist < 10)
    engine.addEnemy({
      id: "e1",
      type: EnemyType.XenoMite,
      pos: { x: 5.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 1,
      speed: 0,
      difficulty: 1,
    });

    // Invalidation happens in UnitManager when enemy is spotted.
    engine.update(16);
    unit = engine.getState().units[0];
    // Should have re-evaluated to Combat (Priority 2)
    expect(unit.activePlan?.behavior).not.toBe("Exploring");
    expect(unit.activePlan?.priority).toBeLessThan(4);
  });

  it("5) Anti-backtracking rejects candidates from position history", () => {
    // 10x10 map
    engine.addUnit({
      id: "u1",
      pos: { x: 5.5, y: 5.5 },
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
      archetypeId: "test",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      positionHistory: [
        { x: 5, y: 6 },
        { x: 5, y: 4 },
        { x: 6, y: 5 },
      ], // Backtracked cells
      aiEnabled: true,
      innateMaxHp: 100,
    });

    // Enemy at (4, 5)
    engine.addEnemy({
      id: "e1",
      type: EnemyType.XenoMite,
      pos: { x: 4.5, y: 5.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 1,
      speed: 0,
      difficulty: 1,
    });

    // Mark neighbors discovered
    const internalState = (engine as any).state;
    // Discover all 8 neighbors plus current cell (5,5) and a 5x5 area to have multiple candidates
    for (let x = 3; x <= 7; x++) {
      for (let y = 3; y <= 7; y++) {
        const key = `${x},${y}`;
        if (!(internalState.discoveredCellsSet?.has(key) ?? internalState.discoveredCells.includes(key))) {
          internalState.discoveredCells.push(key);
        }
        internalState.gridState[y * 10 + x] |= 3; // discovered + visible
      }
    }

    engine.update(16);
    const unit = engine.getState().units[0];
    expect(unit.activePlan?.behavior).toBe("Kiting");
    const goal = unit.activePlan!.goal;
    const goalCell = { x: Math.floor(goal.x), y: Math.floor(goal.y) };

    // Should NOT be any of the backtracked cells, and should NOT be the enemy cell
    expect(goalCell).not.toEqual({ x: 5, y: 6 });
    expect(goalCell).not.toEqual({ x: 5, y: 4 });
    expect(goalCell).not.toEqual({ x: 6, y: 5 });
    expect(goalCell).not.toEqual({ x: 4, y: 5 });

    // It should be one of the remaining valid candidates that are further from enemy than (5.5, 5.5)
    // and not in the position history. 
    const validCandidates = [];
    const enemyPos = { x: 4.5, y: 5.5 };
    const currentDist = 1.0;
    
    const state = engine.getState();
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        const isDiscovered = state.gridState[y * 10 + x] & 2;
        if (!isDiscovered) continue;

        const pos = { x: x + 0.5, y: y + 0.5 };
        const dist = Math.sqrt(Math.pow(pos.x - enemyPos.x, 2) + Math.pow(pos.y - enemyPos.y, 2));
        const isHistory = [
          { x: 5, y: 6 },
          { x: 5, y: 4 },
          { x: 6, y: 5 },
        ].some(h => h.x === x && h.y === y);
        const isEnemy = x === 4 && y === 5;
        
        if (dist > currentDist && !isHistory && !isEnemy) {
          validCandidates.push({ x, y });
        }
      }
    }

    const isValid = validCandidates.some(c => c.x === goalCell.x && c.y === goalCell.y);
    expect(isValid, `Goal ${goalCell.x},${goalCell.y} should be one of the valid candidates. Candidates: ${JSON.stringify(validCandidates)}`).toBe(true);
    expect(validCandidates.length).toBeGreaterThan(1); // Ensure we have multiple choices
  });

  it("6) Cornered unit exception: can revisit cells when no other forward options exist (voidlock-2m8oi.15)", () => {
    // 1x3 dead-end corridor: (0,0) - (1,0) - (2,0)
    const deadEndMap: MapDefinition = {
      width: 3,
      height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
        { x: 2, y: 0, type: CellType.Floor },
      ],
      spawnPoints: [{ id: "s1", pos: { x: 0, y: 0 }, radius: 1 }],
    };
    engine = new CoreEngine({
      map: deadEndMap,
      seed: 123,
      squadConfig: { soldiers: [], inventory: {} },
      agentControlEnabled: true,
      debugOverlayEnabled: true
    });
    engine.clearUnits();

    // Unit at (2,0), neighbor (1,0) is in history
    engine.addUnit({
      id: "u1",
      pos: { x: 2.5, y: 0.5 },
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
      archetypeId: "test",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      positionHistory: [{ x: 1, y: 0 }], // Just came from (1,0)
      aiEnabled: true,
      innateMaxHp: 100,
    });

    // Enemy at (2.2, 0.5) - very close to unit, making (1,0) the only safer option
    engine.addEnemy({
      id: "e1",
      type: EnemyType.XenoMite,
      pos: { x: 2.2, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 1,
      speed: 0,
      difficulty: 1,
    });

    // Mark cells discovered
    const internalState = (engine as any).state;
    for (let x = 0; x < 3; x++) {
      internalState.discoveredCells.push(`${x},0`);
      internalState.gridState[x] |= 3;
    }

    engine.update(16);
    const unit = engine.getState().units[0];
    
    // It should have committed to kiting back to (1,0) despite it being in history
    expect(unit.activePlan?.behavior).toBe("Kiting");
    expect(Math.floor(unit.activePlan!.goal.x)).toBe(1);
    expect(Math.floor(unit.activePlan!.goal.y)).toBe(0);
  });

  it("7) Plan expiry triggers re-evaluation (voidlock-2m8oi.12)", () => {
    // 10x10 L-shaped corridor from Test 2
    const lMap: MapDefinition = {
      width: 10,
      height: 10,
      cells: [
        ...Array(10).fill(null).map((_, i) => ({ x: i, y: 0, type: CellType.Floor })),
        ...Array(9).fill(null).map((_, i) => ({ x: 9, y: i + 1, type: CellType.Floor })),
      ],
      spawnPoints: [{ id: "s1", pos: { x: 0, y: 0 }, radius: 1 }],
    };
    engine = new CoreEngine({
      map: lMap,
      seed: 123,
      squadConfig: { soldiers: [], inventory: {} },
      agentControlEnabled: true,
      debugOverlayEnabled: true
    });
    engine.clearUnits();

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
        speed: 5, // Slow but not too slow
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "test",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      positionHistory: [],
      aiEnabled: true,
      innateMaxHp: 100,
      isDeployed: true,
    });

    const internalState = (engine as any).state;
    // Mark only (0,0) as discovered
    internalState.discoveredCells = ["0,0"];
    for (let i = 0; i < internalState.gridState.length; i++) internalState.gridState[i] = 0;
    internalState.gridState[0] = 3; // (0,0) discovered + visible

    // Add a dummy objective to prevent auto-extraction
    internalState.objectives = [{ id: "o1", kind: "Dummy" as any, state: "Pending", visible: false }];
    (engine as any).unitManager.totalFloorCells = 100; // Mock large floor count

    // 1. First tick triggers exploration
    engine.update(32);
    let unit = engine.getState().units[0];
    
    expect(unit.activePlan?.behavior).toBe("Exploring");
    const initialCommittedUntil = unit.activePlan!.committedUntil;
    expect(initialCommittedUntil).toBeGreaterThan(0);

    // 2. Advance time but stay within commitment (1000ms)
    engine.update(500);
    unit = engine.getState().units[0];
    expect(unit.activePlan!.committedUntil).toBe(initialCommittedUntil);
    expect(engine.getState().t).toBeLessThan(initialCommittedUntil);

    // 3. Advance past commitment
    // Advance by another 600ms (total 1116ms + 32ms initial, past 1032ms approx)
    engine.update(600);
    unit = engine.getState().units[0];
    
    // VERIFICATION: The unit should have re-evaluated and refreshed the commitment.
    expect(unit.activePlan!.committedUntil).toBeGreaterThan(initialCommittedUntil);
    expect(unit.activePlan!.committedUntil).toBeGreaterThanOrEqual(engine.getState().t);
  });

  it("8) Higher-priority behavior interrupts lower-priority plan regardless of commitment", () => {
    // 1. Setup Unit with a manual Exploration Plan (Priority 4)
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
        attackRange: 10,
        speed: 20,
      },
      aiProfile: AIProfile.RUSH,
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "test",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      positionHistory: [],
      aiEnabled: true,
      innateMaxHp: 100,
      isDeployed: true,
      activePlan: {
        behavior: "Exploring",
        goal: { x: 9.5, y: 9.5 },
        committedUntil: engine.getState().t + 5000,
        priority: 4,
      }
    });

    const internalState = (engine as any).state;
    const unitManager = (engine as any).unitManager;

    // 2. Setup an enemy that IS ALREADY tracked as visible to avoid invalidation trigger (hasNewEnemy)
    engine.addEnemy({
      id: "e1",
      type: EnemyType.XenoMite,
      pos: { x: 4.5, y: 0.5 }, 
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 1,
      speed: 0,
      difficulty: 1,
    });
    
    // Mark enemy cell as visible
    internalState.gridState[4] |= 3;
    
    // Inject into lastVisibleEnemyIds to prevent hasNewEnemy invalidation in next update
    unitManager.lastVisibleEnemyIds = new Set(["e1"]);
    const initialCommittedUntil = engine.getState().units[0].activePlan!.committedUntil;

    // 3. Update. UnitAI.process should re-evaluate because priority 2 (Combat) < 4 (Exploration)
    // Even though the plan is committed until +5000ms.
    engine.update(16);
    const unit = engine.getState().units[0];
    
    // VERIFICATION: Exploration (4) was interrupted by Rushing (2)
    expect(unit.activePlan?.behavior).toBe("Rushing");
    expect(unit.activePlan?.priority).toBe(2);
    expect(engine.getState().t).toBeLessThan(initialCommittedUntil);
  });

  it("9) Safety behavior (Priority 0) interrupts Combat plan (Priority 2) regardless of commitment", () => {
    // 1. Setup Unit with a manual Combat Plan (Priority 2)
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
        attackRange: 10,
        speed: 20,
      },
      aiProfile: AIProfile.RUSH,
      commandQueue: [],
      engagementPolicy: "AVOID", // Use AVOID so SafetyBehavior kicks in
      archetypeId: "test",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      positionHistory: [],
      aiEnabled: true,
      innateMaxHp: 100,
      isDeployed: true,
      activePlan: {
        behavior: "Rushing",
        goal: { x: 4.5, y: 0.5 },
        committedUntil: engine.getState().t + 5000,
        priority: 2,
      }
    });

    const internalState = (engine as any).state;
    const unitManager = (engine as any).unitManager;

    // 2. Setup an enemy that IS ALREADY tracked as visible to avoid invalidation trigger
    engine.addEnemy({
      id: "e1",
      type: EnemyType.XenoMite,
      pos: { x: 1.5, y: 0.5 }, // Enemy is close!
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 1,
      speed: 0,
      difficulty: 1,
    });
    
    // Mark enemy cell as visible
    internalState.gridState[1] |= 3;
    
    // Inject into lastVisibleEnemyIds to prevent allVisibleEnemiesGone invalidation
    unitManager.lastVisibleEnemyIds = new Set(["e1"]);
    const initialCommittedUntil = engine.getState().units[0].activePlan!.committedUntil;

    // Discover cells for kiting
    for (let x = 0; x < 10; x++) {
      internalState.gridState[x] |= 2; 
    }

    // 3. Update. UnitAI.process should re-evaluate because priority 0 (Safety) < 2 (Combat)
    engine.update(16);
    const unit = engine.getState().units[0];
    
    // VERIFICATION: Rushing (2) was interrupted by Kiting (0)
    expect(unit.activePlan?.behavior).toBe("Kiting");
    expect(unit.activePlan?.priority).toBe(0);
    expect(engine.getState().t).toBeLessThan(initialCommittedUntil);
  });

  it("10) Invalidation trigger (all enemies dead) correctly causes kiting plan re-evaluation", () => {
    // 1. Setup Unit with AVOID engagement and an enemy in LOS
    engine.addUnit({
      id: "u1",
      pos: { x: 5.5, y: 5.5 },
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
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      engagementPolicy: "AVOID",
      archetypeId: "test",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      positionHistory: [],
      aiEnabled: true,
      innateMaxHp: 100,
      isDeployed: true,
    });

    engine.addEnemy({
      id: "e1",
      type: EnemyType.XenoMite,
      pos: { x: 4.5, y: 5.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 1,
      speed: 0,
      difficulty: 1,
    });

    // Mark some cells discovered for kiting, but leave some undiscovered for exploration
    const internalState = (engine as any).state;
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 10; y++) {
        internalState.discoveredCells.push(`${x},${y}`);
        internalState.gridState[y * 10 + x] |= 3; // visible + discovered
      }
    }
    // Also discover unit's current cell
    internalState.discoveredCells.push("5,5");
    internalState.gridState[5 * 10 + 5] |= 3;

    // Add a Recover objective to ensure re-evaluation to Objective behavior
    internalState.objectives = [{ 
        id: "o1", 
        kind: "Recover", 
        state: "Pending", 
        visible: true,
        targetCell: { x: 9, y: 9 }
    }];
    // Populate visibleCells to ensure ItemDistributionService/ObjectiveBehavior find it
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        internalState.visibleCells.push(`${x},${y}`);
      }
    }
    (engine as any).unitManager.totalFloorCells = 100;
    internalState.map.extraction = undefined;

    // 2. Initial tick to establish Kiting plan (Priority 0)
    engine.update(16);
    let unit = engine.getState().units[0];
    expect(unit.activePlan?.behavior).toBe("Kiting");
    expect(unit.activePlan?.priority).toBe(0);

    // 3. Kill the enemy (set HP to 0)
    // IMPORTANT: Refresh state reference as engine.update might have replaced it
    const stateAfterTick = (engine as any).state;
    stateAfterTick.enemies[0] = { ...stateAfterTick.enemies[0], hp: 0 };

    // 4. Update. UnitManager should detect allVisibleEnemiesGone and invalidate the plan.
    engine.update(16);
    unit = engine.getState().units[0];

    // VERIFICATION: Kiting plan was invalidated and unit re-evaluated
    // Since there is a pending objective, it should re-evaluate to Recovering.
    expect(unit.activePlan?.behavior).toBe("Recovering");
    expect(unit.activePlan?.priority).toBe(3);
  });

  it("11) Invalidation trigger (all enemies dead) correctly causes combat plan re-evaluation", () => {
    // 1. Setup Unit with ENGAGE policy and an enemy in range
    engine.addUnit({
      id: "u1",
      pos: { x: 5.5, y: 5.5 },
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
        speed: 20,
      },
      aiProfile: AIProfile.RUSH,
      commandQueue: [],
      engagementPolicy: "ENGAGE",
      archetypeId: "test",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      positionHistory: [],
      aiEnabled: true,
      innateMaxHp: 100,
      isDeployed: true,
    });

    engine.addEnemy({
      id: "e1",
      type: EnemyType.XenoMite,
      pos: { x: 8.5, y: 5.5 }, // Far enough to trigger Rushing behavior
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 1,
      speed: 0,
      difficulty: 1,
    });

    // Mark cells discovered and visible
    const internalState = (engine as any).state;
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        internalState.discoveredCells.push(`${x},${y}`);
        internalState.gridState[y * 10 + x] |= 3;
        internalState.visibleCells.push(`${x},${y}`);
      }
    }

    // Add a objective to ensure re-evaluation to something else
    internalState.objectives = [{ 
        id: "o1", 
        kind: "Recover", 
        state: "Pending", 
        visible: true,
        targetCell: { x: 0, y: 0 }
    }];
    internalState.map.extraction = undefined;

    // 2. Initial tick to establish Rushing plan (Priority 2)
    engine.update(16);
    let unit = engine.getState().units[0];
    expect(unit.activePlan?.behavior).toBe("Rushing");
    expect(unit.activePlan?.priority).toBe(2);

    // 3. Kill the enemy (set HP to 0)
    const stateAfterTick = (engine as any).state;
    stateAfterTick.enemies[0] = { ...stateAfterTick.enemies[0], hp: 0 };

    // 4. Update. UnitManager should detect allVisibleEnemiesGone and invalidate the plan.
    engine.update(16);
    unit = engine.getState().units[0];

    // VERIFICATION: Combat plan (Rushing) was invalidated and unit re-evaluated
    expect(unit.activePlan?.behavior).toBe("Recovering");
    expect(unit.activePlan?.priority).toBe(3);
  });
});
