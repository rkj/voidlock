import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  EnemyType,
  AIProfile,
} from "../../../shared/types";

describe("Shooting Through Walls Repro", () => {
  let engine: CoreEngine;
  let map: MapDefinition;

  beforeEach(() => {
    // 2x1 map with a wall between (0,0) and (1,0)
    map = {
      width: 2,
      height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
      ],
      walls: [{ p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } }],
      spawnPoints: [],
      extraction: undefined,
      objectives: [],
    };

    engine = new CoreEngine(
      map,
      123,
      { soldiers: [], inventory: {} },
      true,
      false,
    );
    engine.clearUnits();
  });

  it("should NOT allow shooting through a thin wall", () => {
    // Add Soldier at (0.5, 0.5)
    engine.addUnit({
      id: "s1",
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
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
    });

    // Add Enemy at (1.5, 0.5)
    engine.addEnemy({
      id: "e1",
      pos: { x: 1.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      type: EnemyType.SwarmMelee,
      damage: 10,
      fireRate: 100,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
      difficulty: 1,
    });

    // Run update to resolve visibility and combat
    engine.update(100);

    const state = engine.getState();
    const s1 = state.units[0];
    const e1 = state.enemies[0];

    // Check visibility
    expect(state.visibleCells).not.toContain("1,0");

    // S1 should NOT be attacking because LOS is blocked
    expect(s1.state).not.toBe(UnitState.Attacking);
    expect(e1.hp).toBe(100); // No damage dealt
  });

  it("should NOT allow shooting through diagonally", () => {
    // 2x2 map
    const map2x2: MapDefinition = {
      width: 2,
      height: 2,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
        { x: 0, y: 1, type: CellType.Floor },
        { x: 1, y: 1, type: CellType.Floor },
      ],
      walls: [
        { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } },
        { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1 } },
        { p1: { x: 1, y: 0 }, p2: { x: 1, y: 1 } },
        { p1: { x: 0, y: 1 }, p2: { x: 1, y: 1 } },
      ],
      spawnPoints: [],
      extraction: undefined,
      objectives: [],
    };
    const engine2 = new CoreEngine(
      map2x2,
      123,
      { soldiers: [], inventory: {} },
      true,
      false,
    );
    engine2.clearUnits();

    engine2.addUnit({
      id: "s1",
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
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
    });
    engine2.addEnemy({
      id: "e1",
      pos: { x: 1.5, y: 1.5 },
      hp: 100,
      maxHp: 100,
      type: EnemyType.SwarmMelee,
      damage: 10,
      fireRate: 100,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
      difficulty: 1,
    });

    engine2.update(100);

    const state2 = engine2.getState();
    const s1 = state2.units[0];
    const e1 = state2.enemies[0];

    expect(state2.visibleCells).not.toContain("1,1");
    expect(s1.state).not.toBe(UnitState.Attacking);
    expect(e1.hp).toBe(100);
  });

  it("should NOT allow shooting when positioned at cell edges separated by a wall", () => {
    engine.addUnit({
      id: "s1",
      pos: { x: 0.9, y: 0.5 },
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
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
    });
    engine.addEnemy({
      id: "e1",
      pos: { x: 1.1, y: 0.5 },
      hp: 100,
      maxHp: 100,
      type: EnemyType.SwarmMelee,
      damage: 10,
      fireRate: 100,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
      difficulty: 1,
    });

    engine.update(100);

    const s1 = engine.getState().units[0];
    const e1 = engine.getState().enemies[0];

    expect(engine.getState().visibleCells).not.toContain("1,0");
    expect(s1.state).not.toBe(UnitState.Attacking);
    expect(e1.hp).toBe(100);
  });

  it("should NOT see or shoot an off-center enemy through a wall", () => {
    engine.addUnit({
      id: "s1",
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
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
    });
    engine.addEnemy({
      id: "e1",
      pos: { x: 1.1, y: 0.5 },
      hp: 100,
      maxHp: 100,
      type: EnemyType.SwarmMelee,
      damage: 10,
      fireRate: 100,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
      difficulty: 1,
    });

    engine.update(100);

    const state = engine.getState();
    const s1 = state.units[0];
    const e1 = state.enemies[0];

    expect(s1.state).not.toBe(UnitState.Attacking);
    expect(e1.hp).toBe(100);
  });
});
