import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  SquadConfig,
} from "../../shared/types";

describe("Regression a7qk - New Accuracy Formula", () => {
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

  it("should calculate hit chance using the new formula: ((Aim + Mod) / 100) * (Range / Dist)", () => {
    // Formula: HitChance = (accuracy / 100) * (range / distance)
    // If accuracy = 80, range = 10, distance = 10, HitChance = 0.8
    // If accuracy = 80, range = 10, distance = 5, HitChance = 1.6 -> 1.0
    // If accuracy = 80, range = 10, distance = 20, HitChance = 0.4

    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 100,
      accuracy: 80, // (SoldierAim + WeaponMod + EquipBonus)
      attackRange: 10,
      sightRange: 20,
      speed: 20,
      commandQueue: [],
      archetypeId: "assault",
      soldierAim: 75,
      equipmentAccuracyBonus: 0,
    } as any);

    engine.addEnemy({
      id: "e1",
      pos: { x: 10.5, y: 0.5 }, // distance = 10.0
      hp: 10000,
      maxHp: 10000,
      type: "Xeno-Mite" as any,
      damage: 0,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 0,
      speed: 0,
    } as any);

    // Fire 100 shots
    for (let i = 0; i < 100; i++) {
      engine.update(100);
    }

    const state = engine.getState();
    const enemy = state.enemies[0];
    const damageDealt = 10000 - enemy.hp;
    const hits = damageDealt / 10;

    // With old formula (Angular Dispersion):
    // S = 80, distance = 10
    // P = (25 * 80) / (25 * 80 + 10^2 * (100 - 80))
    // P = 2000 / (2000 + 100 * 20) = 2000 / (2000 + 2000) = 0.5
    
    // With new formula:
    // P = (80 / 100) * (10 / 10) = 0.8

    // If new formula is implemented, hits should be around 80.
    // If old formula is still there, hits should be around 50.
    
    expect(hits).toBeGreaterThan(70);
    expect(hits).toBeLessThan(90);
  });

  it("should cap hit chance at 1.0", () => {
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 100,
      accuracy: 80,
      attackRange: 10,
      sightRange: 20,
      speed: 20,
      commandQueue: [],
      archetypeId: "assault",
    } as any);

    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 0.5 }, // distance = 5.0
      hp: 10000,
      maxHp: 10000,
      type: "Xeno-Mite" as any,
      damage: 0,
      fireRate: 1000,
      accuracy: 100,
      attackRange: 0,
      speed: 0,
    } as any);

    // Fire 100 shots
    for (let i = 0; i < 100; i++) {
      engine.update(100);
    }

    const state = engine.getState();
    const enemy = state.enemies[0];
    const damageDealt = 10000 - enemy.hp;
    const hits = damageDealt / 10;

    // New formula: (80/100) * (10/5) = 1.6 -> 1.0
    // Old formula: (25*80) / (25*80 + 5^2 * (100-80)) = 2000 / (2000 + 25 * 20) = 2000 / 2500 = 0.8
    
    expect(hits).toBe(100);
  });
});
