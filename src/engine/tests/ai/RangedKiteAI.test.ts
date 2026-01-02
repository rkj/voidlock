import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  EnemyType,
  AIProfile,
} from "../../../shared/types";

describe("RangedKiteAI", () => {
  let engine: CoreEngine;
  let map: MapDefinition;

  beforeEach(() => {
    // 10x10 open floor map
    const cells: any[] = [];
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        cells.push({ x, y, type: CellType.Floor });
      }
    }
    map = {
      width: 10,
      height: 10,
      cells,
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

  it("should chase soldier if out of range", () => {
    // Enemy at (0.5, 0.5). Range 6.
    engine.addEnemy({
      id: "e1",
      pos: { x: 0.5, y: 0.5 },
      hp: 50,
      maxHp: 50,
      type: EnemyType.SpitterAcid,
      damage: 10,
      fireRate: 800,
      accuracy: 1000,
      attackRange: 6,
      speed: 2,
      difficulty: 1,
    });

    // Soldier at (6.5, 6.5). Distance ~8.5. Visible. Out of range (6).
    engine.addUnit({
      id: "s1",
      pos: { x: 6.5, y: 6.5 },
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

    engine.update(100);
    const enemy = engine.getState().enemies[0];

    // Should move closer
    const newDist = Math.sqrt(
      (enemy.pos.x - 6.5) ** 2 + (enemy.pos.y - 6.5) ** 2,
    );
    const oldDist = Math.sqrt((0.5 - 6.5) ** 2 + (0.5 - 6.5) ** 2);
    expect(newDist).toBeLessThan(oldDist);
  });

  it("should flee if soldier is too close", () => {
    // Enemy at (5.5, 5.5). Range 6.
    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 5.5 },
      hp: 50,
      maxHp: 50,
      type: EnemyType.SpitterAcid,
      damage: 10,
      fireRate: 800,
      accuracy: 1000,
      attackRange: 6,
      speed: 2,
      difficulty: 1,
    });

    // Soldier at (5.5, 4.5). Distance 1. Too close (< 3).
    engine.addUnit({
      id: "s1",
      pos: { x: 5.5, y: 4.5 },
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

    engine.update(100);
    const enemy = engine.getState().enemies[0];

    // Should move AWAY from (5.5, 4.5) -> Move South (increase Y) or other direction
    // Start Y=5.5. Threat Y=4.5. Fleeing increases Y.
    expect(enemy.pos.y).toBeGreaterThan(5.5);
  });

  it("should hold position if in optimal range", () => {
    // Enemy at (5.5, 5.5). Range 6.
    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 5.5 },
      hp: 50,
      maxHp: 50,
      type: EnemyType.SpitterAcid,
      damage: 10,
      fireRate: 800,
      accuracy: 1000,
      attackRange: 6,
      speed: 2,
      difficulty: 1,
    });

    // Soldier at (5.5, 1.5). Distance 4. Optimal is 5.

    engine.addUnit({
      id: "s1",
      pos: { x: 5.5, y: 1.5 },
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
  });
});
