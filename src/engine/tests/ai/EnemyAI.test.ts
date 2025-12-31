import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  SquadConfig,
  CommandType,
} from "../../../shared/types";

describe("Enemy AI", () => {
  let engine: CoreEngine;
  let map: MapDefinition;

  beforeEach(() => {
    // 5x5 open floor map
    const cells: any[] = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        cells.push({ x, y, type: CellType.Floor });
      }
    }
    map = {
      width: 5,
      height: 5,
      cells,
      spawnPoints: [],
      extraction: undefined,
      objectives: [],
    };

    engine = new CoreEngine(map, 123, { soldiers: [], inventory: {} }, true, false);
    engine.clearUnits();
  });

  it("should roam when no soldiers are present", () => {
    engine.addEnemy({
      id: "e1",
      pos: { x: 2.5, y: 2.5 },
      hp: 100,
      maxHp: 100,
      type: "SwarmMelee",
      damage: 10,
      fireRate: 800,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
    });

    const initialPos = { ...engine.getState().enemies[0].pos };

    // Run several updates
    for (let i = 0; i < 10; i++) {
      engine.update(100);
    }

    const finalPos = engine.getState().enemies[0].pos;
    // Should have moved from center
    expect(finalPos.x !== initialPos.x || finalPos.y !== initialPos.y).toBe(
      true,
    );
  });

  it("should move towards detected soldiers", () => {
    // Enemy at (0.5, 0.5)
    engine.addEnemy({
      id: "e1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      type: "SwarmMelee",
      damage: 10,
      fireRate: 800,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
    });

    // Soldier at (4.5, 4.5)
    engine.addUnit({
      id: "s1",
      pos: { x: 4.5, y: 4.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 100,
      accuracy: 1000,
      attackRange: 5,
      sightRange: 10,
      speed: 2,
      commandQueue: [],
      archetypeId: "assault",
    });

    const initialDist = Math.sqrt((0.5 - 4.5) ** 2 + (0.5 - 4.5) ** 2);

    engine.update(100);

    const enemy = engine.getState().enemies[0];
    const soldier = engine.getState().units[0];
    const currentDist = Math.sqrt(
      (enemy.pos.x - soldier.pos.x) ** 2 + (enemy.pos.y - soldier.pos.y) ** 2,
    );

    expect(currentDist).toBeLessThan(initialDist);
    expect(enemy.targetPos).toBeDefined();
  });
});
