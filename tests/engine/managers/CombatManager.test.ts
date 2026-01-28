import { describe, it, expect, vi } from "vitest";
import { CombatManager } from "../../../src/engine/managers/CombatManager";
import { StatsManager } from "../../../src/engine/managers/StatsManager";
import { LineOfSight } from "../../../src/engine/LineOfSight";
import { PRNG } from "../../../src/shared/PRNG";
import {
  Unit,
  GameState,
  UnitState,
  Enemy,
} from "../../../src/shared/types";

describe("CombatManager", () => {
  const mockLos = {
    hasLineOfFire: vi.fn(),
  } as unknown as LineOfSight;

  const statsManager = new StatsManager();
  const combatManager = new CombatManager(mockLos, statsManager);
  const prng = new PRNG(123);

  const createMockUnit = (id: string, x: number, y: number): Unit =>
    ({
      id,
      pos: { x, y },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        speed: 10,
        damage: 10,
        attackRange: 5,
        accuracy: 80,
        fireRate: 500,
        soldierAim: 50,
        equipmentAccuracyBonus: 0,
      },
      archetypeId: "soldier",
      commandQueue: [],
      kills: 0,
      experience: 0,
      level: 1,
    }) as unknown as Unit;

  const createMockEnemy = (id: string, x: number, y: number): Enemy =>
    ({
      id,
      pos: { x, y },
      hp: 50,
      maxHp: 50,
      type: "Worker",
    }) as unknown as Enemy;

  it("should select a target and attack", () => {
    const unit = createMockUnit("u1", 1.5, 1.5);
    const enemy = createMockEnemy("e1", 2.5, 1.5);
    const state: GameState = {
      t: 1000,
      units: [unit],
      enemies: [enemy],
      visibleCells: ["1,1", "2,1"],
    } as unknown as GameState;

    vi.mocked(mockLos.hasLineOfFire).mockReturnValue(true);

    const result = combatManager.update(
      unit,
      state,
      prng,
    );

    const updatedUnit = result.unit;
    expect(result.isAttacking).toBe(true);
    expect(updatedUnit.state).toBe(UnitState.Attacking);
    expect(updatedUnit.forcedTargetId).toBe("e1");
    expect(updatedUnit.lastAttackTime).toBe(1000);
  });

  it("should not attack if no LOF", () => {
    const unit = createMockUnit("u1", 1.5, 1.5);
    const enemy = createMockEnemy("e1", 2.5, 1.5);
    const state: GameState = {
      t: 1000,
      units: [unit],
      enemies: [enemy],
      visibleCells: ["1,1", "2,1"],
    } as unknown as GameState;

    vi.mocked(mockLos.hasLineOfFire).mockReturnValue(false);

    const result = combatManager.update(
      unit,
      state,
      prng,
    );

    const updatedUnit = result.unit;
    expect(result.isAttacking).toBe(false);
    expect(updatedUnit.state).not.toBe(UnitState.Attacking);
    expect(updatedUnit.forcedTargetId).toBeUndefined();
  });

  it("should respect weapon cooldown", () => {
    const unit = createMockUnit("u1", 1.5, 1.5);
    unit.lastAttackTime = 400;
    const enemy = createMockEnemy("e1", 2.5, 1.5);
    const state: GameState = {
      t: 1000,
      units: [unit],
      enemies: [enemy],
      visibleCells: ["1,1", "2,1"],
    } as unknown as GameState;

    vi.mocked(mockLos.hasLineOfFire).mockReturnValue(true);

    // Attack at t=1000 with 500ms cooldown (ok)
    const result1 = combatManager.update(
      unit,
      state,
      prng,
    );
    expect(result1.isAttacking).toBe(true);
    expect(result1.unit.lastAttackTime).toBe(1000);

    // Attack again at t=1100 (too early)
    const state2 = { ...state, t: 1100 };
    const result2 = combatManager.update(
      result1.unit,
      state2,
      prng,
    );

    expect(result2.isAttacking).toBe(true); // Still "attacking" (state-wise) but didn't fire
    expect(result2.unit.lastAttackTime).toBe(1000); // Should NOT have updated
  });
});
