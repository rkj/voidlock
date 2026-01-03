import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  SquadConfig,
  AIProfile,
} from "@src/shared/types";

describe("Coordinated Exploration Refined", () => {
  let engine: CoreEngine;
  let map: MapDefinition;

  beforeEach(() => {
    // 5x1 Map

    map = {
      width: 5,

      height: 1,

      cells: [
        { x: 0, y: 0, type: CellType.Floor },

        { x: 1, y: 0, type: CellType.Floor },

        { x: 2, y: 0, type: CellType.Floor },

        { x: 3, y: 0, type: CellType.Floor },

        { x: 4, y: 0, type: CellType.Floor },
      ],

      spawnPoints: [],

      extraction: { x: 0, y: 0 },

      objectives: [
        {
          id: "obj1",

          kind: "Recover",

          targetCell: { x: 9, y: 9 },
        },
      ],

      doors: [
        {
          id: "d1",

          segment: [
            { x: 0, y: 0 },

            { x: 1, y: 0 },
          ],

          orientation: "Vertical",

          state: "Closed",

          hp: 100,

          maxHp: 100,

          openDuration: 1,
        },

        {
          id: "d2",

          segment: [
            { x: 3, y: 0 },

            { x: 4, y: 0 },
          ],

          orientation: "Vertical",

          state: "Closed",

          hp: 100,

          maxHp: 100,

          openDuration: 1,
        },
      ],
    };

    const squad: SquadConfig = { soldiers: [], inventory: {} };

    engine = new CoreEngine(map, 123, squad, true, false);

    engine.clearUnits();
  });

  it("should spread units to different areas of the map", () => {
    // Place 2 units at center (2,0)

    for (let i = 0; i < 2; i++) {
      engine.addUnit({
        id: `u${i}`,

        pos: { x: 2.5, y: 0.5 },

        hp: 100,

        maxHp: 100,

        state: UnitState.Idle,

        stats: {
          damage: 10,

          fireRate: 100,

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
    }

    // Run update to trigger exploration target assignment

    engine.update(100);

    const state = engine.getState();

    const units = state.units;

    const targets = units.map((u) => u.explorationTarget).filter((t) => !!t);

    expect(targets.length).toBe(2);

    // One should target 0,0, other 4,0

    expect(targets[0]!.x !== targets[1]!.x).toBe(true);
  });

  it("should re-evaluate target if it becomes discovered by another unit", () => {
    engine.addUnit({
      id: "u1",

      pos: { x: 2.5, y: 0.5 },

      hp: 100,

      maxHp: 100,

      state: UnitState.Idle,

      stats: {
        damage: 10,

        fireRate: 100,

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

    engine.addUnit({
      id: "u2",

      pos: { x: 2.5, y: 0.5 },

      hp: 100,

      maxHp: 100,

      state: UnitState.Idle,

      stats: {
        damage: 10,

        fireRate: 100,

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

    engine.update(100);

    const units = engine.getState().units;

    const u1 = units.find((u) => u.id === "u1")!;

    expect(u1.explorationTarget).toBeDefined();

    const target1 = { ...u1.explorationTarget! };

    // Manually discover u1's target in the engine's REAL state
    const key = `${Math.floor(target1.x)},${Math.floor(target1.y)}`;
    (engine as any).state.discoveredCells.push(key);

    // Run update again
    engine.update(100);

    const u1_after = engine.getState().units.find((u) => u.id === "u1")!;
    if (u1_after.explorationTarget) {
      expect(u1_after.explorationTarget).not.toEqual(target1);
    }
  });
});
