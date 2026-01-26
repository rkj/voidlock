import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  SquadConfig,
  AIProfile,
  PickupCommand,
  GameState,
} from "@src/shared/types";
import { LootManager } from "@src/engine/managers/LootManager";

describe("Regression voidlock-z1zk: State Restoration after Manual Actions", () => {
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

  it("should resume AI after a manual PICKUP command if it was enabled before", () => {
    // Add loot at (3, 0)
    const engineInternal = engine as unknown as { state: GameState; lootManager: LootManager };
    const actualState = engineInternal.state;
    engineInternal.lootManager.spawnLoot(actualState, "medkit", {
      x: 3.5,
      y: 0.5,
    });

    expect(actualState.loot.length).toBe(1);
    const lootId = actualState.loot[0].id;

    const unit = engine.getState().units[0];
    expect(unit.aiEnabled).toBe(true);

    // Issue manual PICKUP command
    const pickupCmd: PickupCommand = {
      type: CommandType.PICKUP,
      unitIds: ["u1"],
      lootId: lootId,
    };
    engine.applyCommand(pickupCmd);

    // Verify aiEnabled is false (manual command disables it)
    expect(engine.getState().units[0].aiEnabled).toBe(false);

    // Run updates until loot is picked up
    let lootPickedUp = false;
    for (let i = 0; i < 200; i++) {
      engine.update(100);
      const currentState = engine.getState();
      if (currentState.loot.length === 0) {
        lootPickedUp = true;
        // Wait a few more ticks for the unit to become Idle and process queue
        for (let j = 0; j < 5; j++) engine.update(100);
        break;
      }
    }

    expect(lootPickedUp).toBe(true);
    expect(engine.getState().units[0].aiEnabled).toBe(true);
  });

  it("should resume AI after a manual USE_ITEM command if it was enabled before", () => {
    // Give unit a medkit
    const actualState = (engine as unknown as { state: GameState }).state;
    actualState.squadInventory["medkit"] = 1;

    const unit = engine.getState().units[0];
    expect(unit.aiEnabled).toBe(true);

    // Issue manual USE_ITEM command (Medkit on self)
    engine.applyCommand({
      type: CommandType.USE_ITEM,
      unitIds: ["u1"],
      itemId: "medkit",
      targetUnitId: "u1",
    });

    // Verify aiEnabled is false
    expect(engine.getState().units[0].aiEnabled).toBe(false);

    // Run updates until item is used (Medkit takes 2s = 2000ms)
    // We update by 100ms per tick.
    for (let i = 0; i < 50; i++) {
      engine.update(100);
      if (engine.getState().units[0].aiEnabled) break;
    }

    expect(engine.getState().units[0].aiEnabled).toBe(true);
    expect(engine.getState().squadInventory["medkit"]).toBe(0);
  });
});
