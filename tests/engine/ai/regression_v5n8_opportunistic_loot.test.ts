import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  SquadConfig,
  AIProfile,
} from "@src/shared/types";

describe("Regression voidlock-v5n8: Opportunistic Loot Pickup", () => {
  let engine: CoreEngine;
  let mockMap: MapDefinition;
  const defaultSquad: SquadConfig = {
    soldiers: [],
    inventory: {},
  };

  beforeEach(() => {
    mockMap = {
      width: 5,
      height: 5,
      cells: [],
      spawnPoints: [],
      extraction: { x: 4, y: 4 },
      objectives: [],
    };
    // Fill with floor
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        mockMap.cells.push({ x, y, type: CellType.Floor });
      }
    }

    engine = new CoreEngine(mockMap, 123, defaultSquad, true, false);
    engine.clearUnits();
    engine.addUnit({
      id: "u1",
      archetypeId: "assault",
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
        attackRange: 5,
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      aiEnabled: true,
    });
  });

  it("should autonomously move to and pick up visible loot", () => {
    // Add loot at (3, 0)
    const actualState = (engine as any).state;
    (engine as any).lootManager.spawnLoot(actualState, "medkit", {
      x: 3.5,
      y: 0.5,
    });

    // Verify loot exists in actual state
    expect(actualState.loot.length).toBe(1);
    const lootId = actualState.loot[0].id;

    // Run updates. Unit should detect loot and move to it.
    let lootPickedUp = false;
    for (let i = 0; i < 100; i++) {
      engine.update(100);
      const currentState = engine.getState();
      const unit = currentState.units[0];

      if (currentState.loot.length === 0) {
        lootPickedUp = true;
        break;
      }
    }

    expect(lootPickedUp).toBe(true);
    expect(engine.getState().units[0].aiEnabled).toBe(true);
  });

  it("should coordinate loot pickup between multiple units", () => {
    // Add another unit at (0, 1)
    engine.addUnit({
      id: "u2",
      archetypeId: "assault",
      pos: { x: 0.5, y: 1.5 },
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
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      aiEnabled: true,
    });

    // Add only ONE loot at (3, 0)
    const actualState = (engine as any).state;
    (engine as any).lootManager.spawnLoot(actualState, "medkit", {
      x: 3.5,
      y: 0.5,
    });

    // Run updates
    for (let i = 0; i < 100; i++) {
      engine.update(100);
      const currentState = engine.getState();
      const u1 = currentState.units.find((u) => u.id === "u1")!;
      const u2 = currentState.units.find((u) => u.id === "u2")!;

      // Check that they are not both targeting the same loot
      if (
        u1.activeCommand?.type === CommandType.PICKUP &&
        u2.activeCommand?.type === CommandType.PICKUP
      ) {
        throw new Error("Both units targeting same loot!");
      }

      if (currentState.loot.length === 0) break;
    }

    expect(engine.getState().loot.length).toBe(0);
  });

  it("should autonomously move to and pick up visible objectives", () => {
    // Add a recover objective at (3, 3)
    const state = engine.getState();
    const actualState = (engine as any).state;
    actualState.objectives.push({
      id: "obj-1",
      kind: "Recover",
      state: "Pending",
      targetCell: { x: 3, y: 3 },
      visible: false, // Will be set to true when discovered
    });

    // Run updates. Unit should detect objective and move to it.
    let objectiveCompleted = false;
    for (let i = 0; i < 250; i++) {
      engine.update(100);
      const currentState = engine.getState();
      const unit = currentState.units[0];
      const obj = currentState.objectives.find((o) => o.id === "obj-1")!;

      if (obj.state === "Completed") {
        objectiveCompleted = true;
        break;
      }
    }

    expect(objectiveCompleted).toBe(true);
  });
});
