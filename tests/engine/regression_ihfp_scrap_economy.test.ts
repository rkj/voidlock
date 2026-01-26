import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  SquadConfig,
  EnemyType,
  UnitState,
} from "@src/shared/types";

describe("Scrap Economy Regression", () => {
  const mockMap: MapDefinition = {
    width: 5,
    height: 5,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 2, y: 0, type: CellType.Floor },
      { x: 3, y: 0, type: CellType.Floor },
      { x: 4, y: 0, type: CellType.Floor },
      { x: 0, y: 1, type: CellType.Floor },
      { x: 1, y: 1, type: CellType.Floor },
      { x: 2, y: 1, type: CellType.Floor },
      { x: 3, y: 1, type: CellType.Floor },
      { x: 4, y: 1, type: CellType.Floor },
    ],
    squadSpawn: { x: 0, y: 0 },
    extraction: { x: 4, y: 0 },
    objectives: [{ id: "obj-1", kind: "Recover", targetCell: { x: 2, y: 0 } }],
  };

  const squadConfig: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }],
    inventory: {},
  };

  it("should reward scrap for killing elite enemies", () => {
    const engine = new CoreEngine(mockMap, 123, squadConfig, false, false);

    expect(engine.getState().stats.scrapGained).toBe(0);
    expect(engine.getState().stats.elitesKilled).toBe(0);

    // Add an elite enemy (difficulty 2)
    engine.addEnemy({
      id: "elite-1",
      pos: { x: 1, y: 1 },
      hp: 10,
      maxHp: 10,
      type: EnemyType.WarriorDrone,
      difficulty: 2,
      damage: 10,
      fireRate: 1000,
      accuracy: 50,
      attackRange: 1,
      speed: 10,
    });

    // Kill it - must modify internal state
    const internalState = (engine as any).state;
    const elite = internalState.enemies.find((e: any) => e.id === "elite-1");
    if (elite) elite.hp = 0;

    // Update engine to process death
    engine.update(100);

    const newState = engine.getState();
    expect(newState.stats.aliensKilled).toBe(1);
    expect(newState.stats.elitesKilled).toBe(1);
    expect(newState.stats.scrapGained).toBe(10); // 10 scrap for difficulty 2
  });

  it("should reward scrap for completing objectives", () => {
    const engine = new CoreEngine(mockMap, 123, squadConfig, false, false);

    // Move unit to objective - must modify internal state
    const internalState = (engine as any).state;
    internalState.units[0].pos = { x: 2.5, y: 0.5 };
    internalState.units[0].stats.speed = 60;

    // First update starts channeling

    // First update starts channeling
    engine.update(100);
    expect(internalState.units[0].state).toBe(UnitState.Channeling);

    // Wait for channeling (5 seconds default, adjusted by speed)
    // unit speed is 20 (assault), so duration is 5000 * (10/20) = 2500ms
    engine.update(2500);
    engine.update(100); // Let MissionManager process the completion

    const newState = engine.getState();
    expect(newState.objectives[0].state).toBe("Completed");
    expect(newState.stats.scrapGained).toBe(25); // 25 scrap for Recover objective
  });

  it("should reward bonus scrap on mission win", () => {
    const engine = new CoreEngine(mockMap, 123, squadConfig, false, false);

    // Complete objective
    const internalState = (engine as any).state;
    internalState.units[0].pos = { x: 2.5, y: 0.5 };
    internalState.units[0].stats.speed = 60;

    // First update starts channeling

    engine.update(100); // Start channeling
    engine.update(2500); // Complete channeling
    engine.update(100); // Process completion

    expect(engine.getState().stats.scrapGained).toBe(25);

    // Extract unit
    internalState.units[0].pos = { x: 4.5, y: 0.5 };
    engine.update(100); // Start extraction channeling
    engine.update(2500); // Complete extraction
    engine.update(100); // Process win

    const finalState = engine.getState();
    expect(finalState.status).toBe("Won");
    // 25 (objective) + 100 (win bonus) = 125
    expect(finalState.stats.scrapGained).toBe(125);
  });

  it("should reward small scrap on mission loss", () => {
    const engine = new CoreEngine(mockMap, 123, squadConfig, false, false);

    // Kill all units
    const internalState = (engine as any).state;
    internalState.units.forEach((u: any) => {
      u.hp = 0;
      // CoreEngine update will set state to Dead
    });

    engine.update(100);

    const finalState = engine.getState();
    expect(finalState.status).toBe("Lost");
    expect(finalState.stats.scrapGained).toBe(10); // 10 scrap for loss
  });
});
