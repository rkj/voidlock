import { describe, it, expect } from "vitest";
import {
  CellType,
  UnitState,
  CommandType,
  Vector2,
  Grid,
  Entity,
  Unit,
  Enemy,
  EnemyType,
  SpawnPoint,
  Objective,
  AIProfile,
  MissionType,
} from "@src/shared/types";

describe("Shared Types", () => {
  it("should have correct enum values", () => {
    expect(CellType.Void).toBe("Void");
    expect(UnitState.Moving).toBe("Moving");
    expect(UnitState.Attacking).toBe("Attacking");
    expect(UnitState.Extracted).toBe("Extracted");
    expect(CommandType.MOVE_TO).toBe("MOVE_TO");
    expect(MissionType.RecoverIntel).toBe("RecoverIntel");
  });

  it("should allow Vector2 creation", () => {
    const v: Vector2 = { x: 10, y: 20 };
    expect(v.x).toBe(10);
    expect(v.y).toBe(20);
  });

  it("should define a Grid interface with isWalkable", () => {
    const mockGrid: Grid = {
      width: 10,
      height: 10,
      isWalkable: (x, y) => x > 0 && y > 0,
      canMove: () => true,
    };
    expect(mockGrid.width).toBe(10);
    expect(mockGrid.isWalkable(1, 1)).toBe(true);
    expect(mockGrid.isWalkable(0, 0)).toBe(false);
  });

  it("should include path in Unit type", () => {
    const unitWithOutPath: Unit = {
      id: "u1",
      pos: { x: 0, y: 0 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 500,
        accuracy: 95,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 1,
        speed: 2,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    };
    expect(unitWithOutPath).not.toHaveProperty("path");

    const unitWithPath: Unit = {
      id: "u2",
      pos: { x: 0, y: 0 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Moving,
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      stats: {
        damage: 10,
        fireRate: 500,
        accuracy: 95,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 1,
        speed: 2,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    };
    expect(unitWithPath.path).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
  });

  it("should define Entity, Unit, and Enemy types with combat properties", () => {
    const entity: Entity = {
      id: "e1",
      pos: { x: 5, y: 5 },
      hp: 50,
      maxHp: 50,
    };
    expect(entity.id).toBe("e1");
    expect(entity.hp).toBe(50);

    const unit: Unit = {
      id: "s1",
      pos: { x: 1, y: 1 },
      hp: 80,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 15,
        fireRate: 500,
        accuracy: 95,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 2,
        speed: 2,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    };
    expect(unit.stats.damage).toBe(15);
    expect(unit.stats.attackRange).toBe(2);
    expect(unit.state).toBe(UnitState.Idle);

    const enemy: Enemy = {
      id: "z1",
      pos: { x: 10, y: 10 },
      hp: 30,
      maxHp: 30,
      type: EnemyType.SwarmMelee,
      damage: 5,
      fireRate: 1000,
      accuracy: 50,
      attackRange: 1,
      speed: 2,
      difficulty: 1,
    };
    expect(enemy.id).toBe("z1");
    expect(enemy.type).toBe("swarm-melee");
    expect(enemy.hp).toBe(30);
    expect(enemy.damage).toBe(5);
    expect(enemy.attackRange).toBe(1);
  });

  it("should define SpawnPoint type", () => {
    const sp: SpawnPoint = {
      id: "sp1",
      pos: { x: 20, y: 20 },
      radius: 5,
    };
    expect(sp.id).toBe("sp1");
    expect(sp.pos).toEqual({ x: 20, y: 20 });
  });

  it("should define Objective type", () => {
    const obj: Objective = {
      id: "o1",
      kind: "Recover",
      state: "Pending",
      targetCell: { x: 5, y: 5 },
    };
    expect(obj.id).toBe("o1");
    expect(obj.state).toBe("Pending");
  });
});
