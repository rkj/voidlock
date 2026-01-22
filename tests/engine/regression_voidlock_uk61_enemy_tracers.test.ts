import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../src/engine/CoreEngine";
import {
  MapDefinition,
  SquadConfig,
  MissionType,
  UnitState,
  EnemyType,
  CellType,
} from "../../src/shared/types";

describe("Enemy Tracers Regression (voidlock-uk61)", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
    spawnPoints: [{ id: "sp1", pos: { x: 5, y: 5 }, radius: 1 }],
    squadSpawn: { x: 1, y: 1 },
    extraction: { x: 9, y: 9 },
  };

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor, roomId: "room-1" });
    }
  }

  const squadConfig: SquadConfig = {
    soldiers: [{ id: "s1", archetypeId: "assault", hp: 100 }],
    inventory: {},
  };

  it("should set lastAttackTime and lastAttackTarget when an enemy attacks", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      false,
      false,
      MissionType.Default,
    );

    // Clear initial units/enemies and add our own
    engine.clearUnits();
    engine.addUnit({
      id: "s1",
      archetypeId: "assault",
      pos: { x: 1, y: 1 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 20,
        fireRate: 500,
        accuracy: 90,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 10,
        speed: 20,
      },
      aiEnabled: false,
      commandQueue: [],
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    } as any);

    engine.addEnemy({
      id: "e1",
      type: EnemyType.SpitterAcid,
      pos: { x: 6, y: 6 },
      hp: 100,
      maxHp: 100,
      damage: 10,
      fireRate: 100,
      accuracy: 100,
      attackRange: 10,
      speed: 10,
      difficulty: 1,
    });

    // Update engine to trigger attack
    engine.update(16, 16);

    const updatedState = engine.getState();
    const enemy = updatedState.enemies.find((e) => e.id === "e1");

    expect(enemy).toBeDefined();
    expect(enemy!.lastAttackTime).toBeDefined();
    expect(enemy!.lastAttackTime).toBe(updatedState.t);
    expect(enemy!.lastAttackTarget).toBeDefined();
    expect(enemy!.lastAttackTarget!.x).toBe(1);
    expect(enemy!.lastAttackTarget!.y).toBe(1);

    expect(updatedState.attackEvents).toBeDefined();
    expect(updatedState.attackEvents!.length).toBeGreaterThan(0);
    const event = updatedState.attackEvents!.find((e) => e.attackerId === "e1");
    expect(event).toBeDefined();
    expect(event!.attackerId).toBe("e1");
    expect(event!.targetId).toBe("s1");
    expect(event!.attackerPos.x).toBe(6);
    expect(event!.targetPos.x).toBe(1);
  });
});
