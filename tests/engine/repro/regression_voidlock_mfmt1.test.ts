import { describe, it, expect, vi } from "vitest";
import { CombatManager } from "../../../src/engine/managers/CombatManager";
import { StatsManager } from "../../../src/engine/managers/StatsManager";
import { LineOfSight } from "../../../src/engine/LineOfSight";
import { PRNG } from "../../../src/shared/PRNG";
import { Unit, GameState, UnitState, Enemy } from "../../../src/shared/types";

describe("Regression voidlock-mfmt1: Channeling interruption", () => {
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
      state: UnitState.Channeling,
      channeling: {
        action: "Extract",
        remaining: 5000,
        totalDuration: 5000,
      },
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

  it("should NOT interrupt Channeling state to attack", () => {
    const unit = createMockUnit("u1", 1.5, 1.5);
    const enemy = createMockEnemy("e1", 2.5, 1.5);
    const state: GameState = {
      t: 1000,
      units: [unit],
      enemies: [enemy],
      visibleCells: ["1,1", "2,1"],
      map: { width: 10, height: 10, cells: [] },
    } as unknown as GameState;

    vi.mocked(mockLos.hasLineOfFire).mockReturnValue(true);

    const result = combatManager.update(unit, state, prng);

    const updatedUnit = result.unit;
    // REPRODUCTION: Currently this will FAIL because it will be Attacking
    expect(updatedUnit.state).toBe(UnitState.Channeling);
    expect(result.isAttacking).toBe(false);
  });
});
