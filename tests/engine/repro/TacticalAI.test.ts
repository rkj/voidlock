import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../../src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  AIProfile,
  CommandType,
  SquadConfig,
} from "../../../src/shared/types";

describe("Tactical AI Reproduction Tests", () => {
  let engine: CoreEngine;

  const createMinimalMap = (): MapDefinition => ({
    width: 10,
    height: 10,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 2, y: 0, type: CellType.Floor },
      { x: 3, y: 0, type: CellType.Floor },
      { x: 4, y: 0, type: CellType.Floor },
      { x: 5, y: 0, type: CellType.Floor },
      { x: 0, y: 1, type: CellType.Floor },
      { x: 1, y: 1, type: CellType.Floor },
      { x: 2, y: 1, type: CellType.Floor },
    ],
    spawnPoints: [],
    extraction: { x: 9, y: 9 }, // Far away to avoid accidental extraction
  });

  const discoverCell = (eng: CoreEngine, x: number, y: number) => {
    const state = (eng as any).state;
    if (state.gridState) {
        state.gridState[y * state.map.width + x] |= 3; // bit 1: discovered, bit 0: visible
    }
    if (!state.discoveredCells.includes(`${x},${y}`)) {
        state.discoveredCells.push(`${x},${y}`);
    }
    if (!state.visibleCells.includes(`${x},${y}`)) {
        state.visibleCells.push(`${x},${y}`);
    }
  };

  beforeEach(() => {
    const defaultSquad: SquadConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };
    engine = new CoreEngine(
      createMinimalMap(),
      12345,
      defaultSquad,
      true,
      true,
    );
    engine.clearUnits();
  });

  it("1) Units in IGNORE mode should fire while moving", () => {
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 500,
        accuracy: 1000,
        soldierAim: 100,
        attackRange: 10,
        speed: 60, // 2 tiles/s @ SPEED_NORM=30
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      engagementPolicy: "IGNORE",
      archetypeId: "scout",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      isDeployed: true,
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      type: "grunt" as any,
      damage: 10,
      fireRate: 1000,
      accuracy: 50,
      attackRange: 10,
      speed: 0,
      difficulty: 1,
    });

    const initialHP = 100;

    // Discover the path to target
    for(let x=0; x<=5; x++) discoverCell(engine, x, 0);

    // Issue MOVE command
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 5, y: 0 },
    });

    engine.update(100);

    const state = engine.getState();
    let unit = state.units[0];
    let enemy = state.enemies[0];

    // Unit should be attacking while moving
    expect(unit.state).toBe(UnitState.Attacking); 
    expect(unit.pos.x).toBeGreaterThan(0.5); // Should have moved
    
    // Update more to ensure damage is dealt
    for(let i=0; i<10; i++) engine.update(100);
    
    unit = engine.getState().units[0];
    enemy = state.enemies[0];

    expect(enemy.hp).toBeLessThan(initialHP); 
    expect(unit.pos.x).toBeGreaterThan(1.1); // 0.5 + 0.688 = 1.188 (Scout speed 30)
  });

  it("2) Units in AVOID mode should maintain LOS while kiting", () => {
    // Map with a LONG corridor and a side room
    const customMap: MapDefinition = {
        width: 20,
        height: 10,
        cells: [],
        spawnPoints: [],
        extraction: { x: 0, y: 0 },
    };
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 20; x++) {
            if (y === 1 && x >= 5 && x <= 10) { // Corridor from 5 to 10
                customMap.cells.push({ x, y, type: CellType.Floor });
            } else if (x === 6 && y >= 2 && y <= 4) { // Side Room at x=6, y=2..4
                customMap.cells.push({ x, y, type: CellType.Floor });
            }
        }
    }

    engine = new CoreEngine(customMap, 12345, { soldiers: [], inventory: {} }, true, true);
    engine.clearUnits();

    engine.addUnit({
      id: "u1",
      pos: { x: 5.5, y: 1.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: { damage: 10, fireRate: 500, accuracy: 1000, soldierAim: 100, attackRange: 10, speed: 30, equipmentAccuracyBonus: 0 },
      aiProfile: AIProfile.RETREAT,
      commandQueue: [],
      engagementPolicy: "AVOID",
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      aiEnabled: true,
      isDeployed: true,
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 1.5 },
      hp: 100,
      maxHp: 100,
      type: "grunt" as any,
      damage: 10, fireRate: 1000, accuracy: 50, attackRange: 1, speed: 0, difficulty: 1,
    });

    // Discover the corridor and side room cells
    for (let x = 5; x <= 10; x++) discoverCell(engine, x, 1);
    discoverCell(engine, 6, 2);

    engine.update(100);
    engine.update(100);

    const state = engine.getState();
    const unit = state.units[0];

    // DESIRED: It should stay in corridor (y=1.5) to maintain LOS
    // It should move to x=6.5 (next cell in corridor)
    expect(unit.targetPos?.y).toBe(1.5);
    expect(unit.targetPos?.x).toBeGreaterThan(5.5);
  });

  it("3) VIPs should flee directly toward extraction", () => {
    const customMap: MapDefinition = {
        width: 20,
        height: 10,
        cells: [],
        spawnPoints: [],
        extraction: { x: 19, y: 1 },
    };
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 20; x++) {
            customMap.cells.push({ x, y, type: CellType.Floor });
        }
    }
    
    engine = new CoreEngine(customMap, 12345, { soldiers: [], inventory: {} }, true, true);
    engine.clearUnits();

    engine.addUnit({
      id: "v1",
      pos: { x: 5.5, y: 5.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: { damage: 0, fireRate: 0, accuracy: 0, soldierAim: 0, attackRange: 0, speed: 30, equipmentAccuracyBonus: 0 },
      aiProfile: AIProfile.RETREAT,
      commandQueue: [],
      archetypeId: "vip",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      aiEnabled: true,
      isDeployed: true,
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 7.5, y: 5.5 },
      hp: 100,
      maxHp: 100,
      type: "grunt" as any,
      damage: 10, fireRate: 1000, accuracy: 50, attackRange: 10, speed: 0, difficulty: 1,
    });

    // Extraction is at (19, 1). 
    // Discover cells around VIP to allow fleeing logic to have candidates.
    for (let x = 0; x < 20; x++) {
        for (let y = 0; y < 10; y++) {
            discoverCell(engine, x, y);
        }
    }

    engine.update(100);
    engine.update(100);

    const state = engine.getState();
    const vip = state.units[0];

    // VIP should be moving toward extraction (19,1), even if enemy is at (7.5, 5.5)
    // Extraction is at (19, 1), start is (5.5, 5.5). 
    // It should move either Right (x > 5.5) or Up (y < 5.5).
    expect(vip.targetPos).toBeDefined();
    const movedRight = vip.targetPos && vip.targetPos.x > 5.5;
    const movedUp = vip.targetPos && vip.targetPos.y < 5.5;
    expect(movedRight || movedUp).toBe(true);
  });
});
