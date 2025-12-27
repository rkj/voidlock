import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  SquadConfig,
} from "../../../shared/types";

describe("Combat Accuracy (Angular Dispersion)", () => {
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
    // Use a fixed seed for deterministic results in some tests
    engine = new CoreEngine(mockMap, 12345, defaultSquad, false, false);
    engine.clearUnits();
  });

  it("should have 100% hit chance at point blank (distance < 0.5/tan(disp))", () => {
    // accuracy = 10 degrees -> tan(10) = 0.176
    // 50% range = 0.5 / 0.176 = 2.83
    // At distance 1.0, hitChance = 0.5 / (1.0 * 0.176) = 2.83 -> clamped to 1.0
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 100,
      accuracy: 10,
      attackRange: 10,
      sightRange: 20,
      speed: 20,
      commandQueue: [],
      archetypeId: "assault",
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 1.5, y: 0.5 }, // distance = 1.0
      hp: 1000,
      maxHp: 1000,
      type: "Xeno-Mite",
      damage: 0,
      fireRate: 1000,
      accuracy: 0,
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

  it("should have ~50% hit chance at calculated 50% range", () => {
    // dispersion = 11.3099 degrees (atan(0.2 * 0.5/0.5? No, atan(0.1) for 50% at 5 tiles if hitChance = 0.5/(d*tan)))
    // Wait, formula hitChance = 0.5 / (distance * tan(dispersion))
    // 0.5 = 0.5 / (distance * tan(dispersion))  => distance * tan(dispersion) = 1.0 => distance = 1 / tan(dispersion)
    // If dispersion = 11.31 degrees, tan(disp) = 0.2, so distance = 5.0
    
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 100,
      accuracy: 11.31,
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
      accuracy: 0,
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
    
    // Expect around 50 hits (give some margin for RNG)
    expect(hits).toBeGreaterThan(35);
    expect(hits).toBeLessThan(65);
  });

  it("should have 100% hit chance if accuracy is 0", () => {
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 100,
      accuracy: 0,
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
      accuracy: 0,
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
    // distance = 5.0, dispersion = 11.31 -> hitChance = 0.5
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 10000,
      maxHp: 10000,
      state: UnitState.Idle,
      damage: 0,
      fireRate: 1000,
      accuracy: 0,
      attackRange: 0,
      sightRange: 20,
      speed: 20,
      commandQueue: [],
      archetypeId: "assault",
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      type: "Spitter-Acid",
      damage: 10,
      fireRate: 100,
      accuracy: 11.31,
      attackRange: 10,
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
