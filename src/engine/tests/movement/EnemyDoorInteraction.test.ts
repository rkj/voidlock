import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../CoreEngine";
import {
  MapDefinition,
  CellType,
  Door,
  UnitState,
} from "../../../shared/types";

describe("Enemy Door Interaction", () => {
  let engine: CoreEngine;
  let map: MapDefinition;

  beforeEach(() => {
    // 2x1 map with a CLOSED door between (0,0) and (1,0)
    const door: Door = {
      id: "d1",
      segment: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      orientation: "Vertical",
      state: "Closed",
      hp: 100,
      maxHp: 100,
      openDuration: 0.1, // Fast open
    };

    map = {
      width: 2,
      height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
      ],
      doors: [door],
      spawnPoints: [],
      extraction: undefined,
      objectives: [],
    };

    engine = new CoreEngine(map, 123, [], true, false);
    engine.clearUnits();
  });

  it("should open a closed door when an enemy approaches", () => {
    // Enemy at (0.5, 0.5), moving to (1.5, 0.5)
    engine.addEnemy({
      id: "e1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      type: "SwarmMelee",
      damage: 10,
      fireRate: 100,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
      targetPos: { x: 1.5, y: 0.5 },
      path: [{ x: 1, y: 0 }],
    });

    // Add dummy soldier to keep game running
    engine.addUnit({
      id: "s1",
      pos: { x: 5, y: 5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 0,
      fireRate: 0,
      accuracy: 1000,
      attackRange: 0,
      sightRange: 0,
      speed: 2,
      commandQueue: [],
      archetypeId: "assault",
    });

    // Run updates. Door open duration is 0.1s (100ms).
    // Tick 1: Enemy is at (0,0). Door logic checks adjacency. Should trigger open.
    engine.update(100);

    let door = engine.getState().map.doors![0];
    let enemy = engine.getState().enemies[0];

    // Door should be opening or open
    expect(door.openTimer).toBeDefined();

    // Tick 2: Timer expires
    engine.update(100);
    door = engine.getState().map.doors![0];

    expect(door.state).toBe("Open");

    // Tick 3: Enemy moves through
    engine.update(100);
    enemy = engine.getState().enemies[0];

    // Enemy speed is default? SwarmMelee usually fast?
    // Let's check if it moved.
    expect(enemy.pos.x).toBeGreaterThan(0.5);
  });
});
