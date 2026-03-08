import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  Door,
  UnitState,
  EnemyType,
  AIProfile,
} from "@src/shared/types";

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

    engine = new CoreEngine(
      map,
      123,
      { soldiers: [], inventory: {} },
      true,
      false,
    );
    engine.clearUnits();
  });

  it("should open a closed door when an enemy approaches", () => {
    // Enemy at (0.5, 0.5), moving to (1.5, 0.5)
    engine.addEnemy({
      id: "e1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      type: EnemyType.SwarmMelee,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 100,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
      difficulty: 1,
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
      stats: {
        damage: 0,
        fireRate: 0,
        accuracy: 1000,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 5,
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });

    // Run updates. Door open duration is 0.1s (100ms).
    // Tick 1: Enemy is at (0.5, 0.5). Door logic checks adjacency. Should trigger open.
    engine.update(16);

    let door = engine.getState().map.doors![0];
    let enemy = engine.getState().enemies[0];

    // Door should be opening
    expect(door.openTimer).toBeDefined();
    // Enemy should be in Waiting for Door state because door is still Closed
    expect(enemy.state).toBe(UnitState.WaitingForDoor);

    // Tick 2: Timer expires (enough to cross 100ms open duration)
    engine.update(128); // 8 * 16ms
    door = engine.getState().map.doors![0];
    expect(door.state).toBe("Open");

    // Tick 3: Enemy moves through
    engine.update(100);
    enemy = engine.getState().enemies[0];

    expect(enemy.state).toBe(UnitState.Moving);
    expect(enemy.pos.x).toBeGreaterThan(0.5);
  });

  it("should be blocked by a locked door", () => {
    // Set door to Locked
    const door = engine.getState().map.doors![0];
    door.state = "Locked";
    engine.doors.set(door.id, door);

    // Enemy at (0.5, 0.5), moving to (1.5, 0.5)
    engine.addEnemy({
      id: "e1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      type: EnemyType.SwarmMelee,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 100,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
      difficulty: 1,
      targetPos: { x: 1.5, y: 0.5 },
      path: [{ x: 1, y: 0 }],
    });

    // Run updates
    engine.update(100);

    let enemy = engine.getState().enemies[0];
    let doorState = engine.getState().map.doors![0].state;

    expect(doorState).toBe("Locked");
    // Enemy should be stuck and in Waiting for Door state
    expect(enemy.state).toBe(UnitState.WaitingForDoor);
    expect(enemy.pos.x).toBe(0.5); // Should not have moved
  });
});
