import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  SquadConfig,
} from "../../../shared/types";

describe("Combat Accuracy (Percentage Model)", () => {
  let engine: CoreEngine;
  const mockMap: MapDefinition = {
    width: 20,
    height: 3,
    cells: Array.from({ length: 60 }, (_, i) => ({
      x: i % 20,
      y: Math.floor(i / 20),
      type: CellType.Floor,
    })),
    spawnPoints: [],
    extraction: { x: 19, y: 0 },
    objectives: [],
  };

  beforeEach(() => {
    const defaultSquad: SquadConfig = [{ archetypeId: "assault", count: 1 }];
    // Use a fixed seed for deterministic results
    engine = new CoreEngine(mockMap, 12345, defaultSquad, false, false);
    engine.clearUnits();
  });

  it("should have 100% hit chance if distance <= accuracy * 5 / 100", () => {
    // accuracy = 100 -> 100% hit at 5 tiles
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 100,
      accuracy: 100,
      attackRange: 10,
      sightRange: 20,
      speed: 20,
      commandQueue: [],
      archetypeId: "assault",
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 0.5 }, // distance = 5.0
      hp: 1000,
      maxHp: 1000,
      type: "Xeno-Mite",
      damage: 0,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 0,
      speed: 0,
    });

    // Fire 10 shots
    for (let i = 0; i < 10; i++) {
      engine.update(100);
    }

    const state = engine.getState();
    const enemy = state.enemies[0];
    // Each shot 10 damage, 10 shots -> 100 damage
    expect(enemy.hp).toBe(900);
  });

  it("should have 50% hit chance at double the perfect range", () => {
    // accuracy = 100 -> 100% hit at 5 tiles, 50% hit at 10 tiles
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 100,
      accuracy: 100,
      attackRange: 15,
      sightRange: 20,
      speed: 20,
      commandQueue: [],
      archetypeId: "assault",
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 10.5, y: 0.5 }, // distance = 10.0
      hp: 10000,
      maxHp: 10000,
      type: "Xeno-Mite",
      damage: 0,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 0,
      speed: 0,
    });

    // Fire 100 shots
    for (let i = 0; i < 100; i++) {
      engine.update(100);
    }

    const state = engine.getState();
    const enemy = state.enemies[0];
    const damageDealt = 10000 - enemy.hp;
    const hits = damageDealt / 10;
    
    // Expect around 50 hits
    expect(hits).toBeGreaterThan(35);
    expect(hits).toBeLessThan(65);
  });

  it("should have 50% hit chance at 5 tiles if accuracy is 50", () => {
    // accuracy = 50 -> 50% hit at 5 tiles
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 100,
      accuracy: 50,
      attackRange: 10,
      sightRange: 20,
      speed: 20,
      commandQueue: [],
      archetypeId: "assault",
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 0.5 }, // distance = 5.0
      hp: 10000,
      maxHp: 10000,
      type: "Xeno-Mite",
      damage: 0,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 0,
      speed: 0,
    });

    // Fire 100 shots
    for (let i = 0; i < 100; i++) {
      engine.update(100);
    }

    const state = engine.getState();
    const enemy = state.enemies[0];
    const damageDealt = 10000 - enemy.hp;
    const hits = damageDealt / 10;
    
    // Expect around 50 hits
    expect(hits).toBeGreaterThan(35);
    expect(hits).toBeLessThan(65);
  });

  it("should have 100% hit chance if accuracy is very high (e.g. 1000)", () => {
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 100,
      accuracy: 1000,
      attackRange: 15,
      sightRange: 20,
      speed: 20,
      commandQueue: [],
      archetypeId: "assault",
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 10.5, y: 0.5 }, // distance = 10.0
      hp: 1000,
      maxHp: 1000,
      type: "Xeno-Mite",
      damage: 0,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 0,
      speed: 0,
    });

    // Fire 10 shots
    for (let i = 0; i < 10; i++) {
      engine.update(100);
    }

    const state = engine.getState();
    const enemy = state.enemies[0];
    expect(enemy.hp).toBe(900);
  });

  it("should correctly calculate hit chance for enemies attacking units", () => {
    // distance = 10.0, accuracy = 100 -> hitChance = 0.5
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 10000,
      maxHp: 10000,
      state: UnitState.Idle,
      damage: 0,
      fireRate: 1000,
      accuracy: 1000,
      attackRange: 0,
      sightRange: 20,
      speed: 20,
      commandQueue: [],
      archetypeId: "assault",
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 10.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      type: "Spitter-Acid",
      damage: 10,
      fireRate: 100,
      accuracy: 100,
      attackRange: 15,
      speed: 0,
    });

    // Fire 100 shots
    for (let i = 0; i < 100; i++) {
      engine.update(100);
    }

    const state = engine.getState();
    const unit = state.units[0];
    const damageDealt = 10000 - unit.hp;
    const hits = damageDealt / 10;
    
    expect(hits).toBeGreaterThan(35);
    expect(hits).toBeLessThan(65);
  });
});