import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  SquadConfig,
} from "../../../shared/types";

describe("Command: SET_ENGAGEMENT (Policy Logic)", () => {
  let engine: CoreEngine;
  const map: MapDefinition = {
    width: 10,
    height: 10,
    cells: Array(100)
      .fill(null)
      .map((_, i) => ({
        x: i % 10,
        y: Math.floor(i / 10),
        type: CellType.Floor,
      })),
    spawnPoints: [],
    extraction: { x: 9, y: 9 },
    objectives: [],
  };

  beforeEach(() => {
    const defaultSquad: SquadConfig = [{ archetypeId: "assault", count: 1 }];
    engine = new CoreEngine(map, 123, defaultSquad, false, false);
    engine.clearUnits();
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
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
      engagementPolicy: "IGNORE", // Start with IGNORE
      archetypeId: "assault",
    });
    engine.addEnemy({
      id: "e1",
      pos: { x: 1.5, y: 0.5 }, // Adjacent
      hp: 100,
      maxHp: 100,
      type: "Grunt",
      damage: 0,
      fireRate: 1000,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
    });
  });

  it("should NOT attack when Idle if policy is IGNORE", () => {
    // Unit is Idle. Enemy is in range. Policy is IGNORE.
    // BUG: Current logic allows attack if !isMoving.

    engine.update(100);

    const state = engine.getState();
    const u1 = state.units.find((u) => u.id === "u1");
    const e1 = state.enemies.find((e) => e.id === "e1");

    // Expectation: Should NOT be attacking
    expect(u1?.state).toBe(UnitState.Idle);
    expect(e1?.hp).toBe(100);
  });

  it("should attack if explicitly ordered even if IGNORE", () => {
    // Force attack
    engine.applyCommand({
      type: CommandType.ATTACK_TARGET,
      unitId: "u1",
      targetId: "e1",
    });

    engine.update(100);

    const state = engine.getState();
    const u1 = state.units.find((u) => u.id === "u1");
    const e1 = state.enemies.find((e) => e.id === "e1");

    expect(u1?.state).toBe(UnitState.Attacking);
    expect(e1?.hp).toBeLessThan(100);
  });

  it("should NOT reset Manual IGNORE to ENGAGE when idle", () => {
    // Remove enemy to ensure unit is safe and not isolated (no threats)
    (engine as any).state.enemies = [];

    // Set Manual IGNORE
    engine.applyCommand({
      type: CommandType.SET_ENGAGEMENT,
      unitIds: ["u1"],
      mode: "IGNORE",
    });

    // Update to process command
    engine.update(100);

    let u1 = engine.getState().units.find((u) => u.id === "u1");
    expect(u1?.engagementPolicy).toBe("IGNORE");

    // Now ensure unit is Idle and check if it resets
    // It is already Idle since we didn't move it.
    // The reset logic runs in update().

    engine.update(100); // Trigger potential reset

    u1 = engine.getState().units.find((u) => u.id === "u1");
    expect(u1?.engagementPolicy).toBe("IGNORE"); // Should still be IGNORE
  });
});
