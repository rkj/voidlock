import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  SquadConfig,
} from "../../../shared/types";

describe("Coordinated Objectives AI", () => {
  let engine: CoreEngine;
  let mockMap: MapDefinition;
  const defaultSquad: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }, { archetypeId: "assault" }],
    inventory: {},
  };

  beforeEach(() => {
    mockMap = {
      width: 20,
      height: 20,
      cells: [],
      spawnPoints: [{ id: "s1", pos: { x: 0, y: 0 }, radius: 1 }],
      extraction: { x: 19, y: 19 },
      objectives: [
        {
          id: "obj1",
          kind: "Recover",
          targetCell: { x: 15, y: 15 },
          visible: true,
        } as any,
      ],
    };

    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        mockMap.cells.push({ x, y, type: CellType.Floor });
      }
    }

    // Set fogOfWar to false so objectives are visible
    // Signature: map, seed, squadConfig, agentControlEnabled, debugOverlayEnabled
    engine = new CoreEngine(mockMap, 123, defaultSquad, true, false);
    engine.clearUnits();

    // Unit 1 closer to objective
    engine.addUnit({
      id: "u1",
      pos: { x: 14.5, y: 14.5 },
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
        sightRange: 0.1,
        speed: 10,
      },
      commandQueue: [],
      archetypeId: "assault",
    });

    // Unit 2 further from objective
    engine.addUnit({
      id: "u2",
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
        sightRange: 0.1,
        speed: 10,
      },
      commandQueue: [],
      archetypeId: "assault",
    });
  });

  it("should NOT have multiple units moving to the same objective", () => {
    // Both units are Idle, one objective is visible.
    // u1 is closer (dist ~0.7), u2 is further (dist ~6.3)

    engine.update(100);

    const state1 = engine.getState();
    const u1 = state1.units.find((u) => u.id === "u1")!;
    const u2 = state1.units.find((u) => u.id === "u2")!;

    expect(u1.activeCommand?.label).toBe("Recovering");

    // u2 should NOT be recovering since u1 claimed it
    expect(u2.activeCommand?.label).not.toBe("Recovering");
    // u2 should be exploring or something else
    expect(u2.activeCommand?.label).toBe("Exploring");
  });

  it("should NOT claim the same objective in subsequent ticks if one unit is already moving to it", () => {
    // 1. Initial update. u1 claims obj1.
    engine.update(100);

    let state = engine.getState();
    let u1 = state.units.find((u) => u.id === "u1")!;
    let u2 = state.units.find((u) => u.id === "u2")!;

    expect(u1.activeCommand?.label).toBe("Recovering");
    expect(u2.activeCommand?.label).toBe("Exploring");

    // 2. Second update.
    // If the bug exists, u1 doesn't "claim" it in this tick's local claimedObjectives set,
    // so u2 might see it as available if it finishes its exploration target or re-evaluates.

    // Force u2 to re-evaluate by clearing its exploration target
    u2.explorationTarget = undefined;

    engine.update(100);

    state = engine.getState();
    u1 = state.units.find((u) => u.id === "u1")!;
    u2 = state.units.find((u) => u.id === "u2")!;

    expect(u1.activeCommand?.label).toBe("Recovering");
    // BUG: u2 might now be "Recovering" too
    expect(u2.activeCommand?.label).not.toBe("Recovering");
  });

  it("should NOT have multiple units channeling the same objective", () => {
    // Force both units to be at the same objective cell
    engine.clearUnits();
    engine.addUnit({
      id: "u1",
      pos: { x: 15.5, y: 15.5 },
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
        sightRange: 0.1,
        speed: 10,
      },
      commandQueue: [],
      archetypeId: "assault",
    });
    engine.addUnit({
      id: "u2",
      pos: { x: 15.5, y: 15.5 },
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
        sightRange: 0.1,
        speed: 10,
      },
      commandQueue: [],
      archetypeId: "assault",
    });

    engine.update(100);

    const state = engine.getState();
    const u1 = state.units.find((u) => u.id === "u1")!;
    const u2 = state.units.find((u) => u.id === "u2")!;

    // One should be channeling, the other should NOT
    const u1Channeling = u1.state === UnitState.Channeling;
    const u2Channeling = u2.state === UnitState.Channeling;

    expect(u1Channeling || u2Channeling).toBe(true);
    expect(u1Channeling && u2Channeling).toBe(false);
  });
});
