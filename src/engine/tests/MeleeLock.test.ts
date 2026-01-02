import { describe, it, expect } from "vitest";
import { CoreEngine } from "../CoreEngine";
import {
  MapDefinition,
  CellType,
  SquadConfig,
  MissionType,
  CommandType,
  UnitState,
  EnemyType,
  AIProfile,
} from "../../shared/types";

const mockMap: MapDefinition = {
  width: 3,
  height: 1,
  cells: [
    {
      x: 0,
      y: 0,
      type: CellType.Floor,
    },
    {
      x: 1,
      y: 0,
      type: CellType.Floor,
    },
    {
      x: 2,
      y: 0,
      type: CellType.Floor,
    },
  ],
  spawnPoints: [],
};

const mockSquad: SquadConfig = {
  soldiers: [{ archetypeId: "assault" }],
  inventory: {},
};
describe("Melee Lock & Ignore Policy", () => {
  it("should force combat and block movement when in same cell, even if IGNORE", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [], inventory: {} },
      true,
      false,
      MissionType.Default,
    );

    // Manually add Soldier
    engine.addUnit({
      id: "s1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 100,
        accuracy: 1000,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 1,
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      aiEnabled: true,
      commandQueue: [],
      engagementPolicy: "IGNORE",
      archetypeId: "assault",
    });

    const state = engine.getState();
    // soldier is now in state.units
    const soldier = state.units.find((u) => u.id === "s1")!;

    // Add Enemy at 0,0
    engine.addEnemy({
      id: "enemy-1",
      type: EnemyType.AlienScout,
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      damage: 10,
      fireRate: 500,
      accuracy: 1000,
      attackRange: 2,
      speed: 1,
      difficulty: 1,
    });

    // Order Soldier to Move to 2,0
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [soldier.id],
      target: { x: 2, y: 0 },
    });

    // Tick the engine
    // Soldier should NOT move, but SHOULD attack
    engine.update(100);

    const updatedState = engine.getState();
    const updatedSoldier = updatedState.units[0];
    const updatedEnemy = updatedState.enemies[0];

    // Check 1: Movement Blocked?
    // If it moved, x would be > 0.5
    // Speed is usually > 1 tile/sec? Grunt speed is usually ~4?
    // 100ms = 0.1s. Move dist = 0.4. Pos would be 0.9.
    // If blocked, pos remains 0.5 (or very close if logic is strict).
    // Actually, "Locked in Melee" means "cannot move".

    // Check 2: Did it attack?
    // Enemy HP should decrease.

    // NOTE: This test is expected to FAIL on current implementation
    // (Soldier will move because IGNORE policy takes precedence and no melee lock exists)

    console.log(
      `Soldier Pos: ${updatedSoldier.pos.x}, Enemy HP: ${updatedEnemy.hp}`,
    );

    // Expectation for NEW behavior:
    expect(updatedSoldier.pos.x).toBeCloseTo(0.5, 0.1); // Should not have moved
    expect(updatedEnemy.hp).toBeLessThan(100); // Should have attacked
  });

  it("should lock enemy movement if soldier is in same cell", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [], inventory: {} },
      true,
      false,
      MissionType.Default,
    );

    // Manually add Soldier at 1,0
    engine.addUnit({
      id: "s1",
      pos: { x: 1.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 100,
        accuracy: 1000,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 1,
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      aiEnabled: true,
      commandQueue: [],
      archetypeId: "assault",
    });

    const state = engine.getState();
    const soldier = state.units[0];

    // Add Enemy at 1,0
    engine.addEnemy({
      id: "enemy-1",
      type: EnemyType.AlienScout,
      pos: { x: 1.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      damage: 10,
      fireRate: 500,
      accuracy: 1000,
      attackRange: 2,
      speed: 5, // Fast enemy
      difficulty: 1,
    });

    // Force Enemy to have a path (manual hack since we can't easily command enemies)
    const enemy = engine["state"].enemies[0]; // Access internal state directly for setup
    enemy.targetPos = { x: 2.5, y: 0.5 };
    enemy.path = [{ x: 2, y: 0 }];

    // Tick
    engine.update(100);

    const updatedEnemy = engine.getState().enemies[0];

    // Expectation: Enemy blocked
    expect(updatedEnemy.pos.x).toBeCloseTo(1.5, 0.1);
  });
});
