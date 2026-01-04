import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  CellType,
  UnitState,
  CommandType,
  SquadConfig,
  AIProfile,
  MapDefinition,
  PickupCommand,
} from "@src/shared/types";

describe("Loot Mechanics", () => {
  let engine: CoreEngine;
  const mockMap: MapDefinition = {
    width: 5,
    height: 5,
    cells: [],
    spawnPoints: [],
    extraction: { x: 4, y: 4 },
  };

  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor });
    }
  }

  beforeEach(() => {
    const defaultSquad: SquadConfig = {
      soldiers: [],
      inventory: {},
    };
    engine = new CoreEngine(mockMap, 123, defaultSquad, false, false);
    engine.clearUnits();
  });

  it("should allow spawning and picking up loot", () => {
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 20,
        fireRate: 500,
        accuracy: 90,
        soldierAim: 90,
        attackRange: 5,
        speed: 20,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
    } as any);

    // Manually spawn loot (via engine internal for testing)
    const engineInternal = engine as any;
    engineInternal.lootManager.spawnLoot(engineInternal.state, "medkit", {
      x: 2.5,
      y: 2.5,
    });

    expect(engine.getState().loot.length).toBe(1);
    const lootId = engine.getState().loot[0].id;

    engine.applyCommand({
      type: CommandType.PICKUP,
      unitIds: ["u1"],
      lootId: lootId,
    } as PickupCommand);

    // Update to reach loot (pos 0.5, 0.5 to 2.5, 2.5 is dist ~2.8. Speed 20 is 0.66 tiles/s. Should take ~4.2s)
    let reached = false;
    for (let i = 0; i < 100; i++) {
      engine.update(100);
      if (engine.getState().units[0].state === UnitState.Channeling) {
        reached = true;
        break;
      }
    }

    expect(reached).toBe(true);

    // Should be at loot position and starting channeling
    const stateAfterMove = engine.getState();
    expect(stateAfterMove.units[0].state).toBe(UnitState.Channeling);
    expect(stateAfterMove.units[0].channeling?.action).toBe("Pickup");

    // Wait for channeling (1s)
    engine.update(1100);

    const finalState = engine.getState();
    expect(finalState.units[0].state).toBe(UnitState.Idle);
    expect(finalState.loot.length).toBe(0);
    expect(finalState.squadInventory["medkit"]).toBe(1);
  });

  it("should drop artifact as loot when unit dies", () => {
    engine.addUnit({
      id: "u1",
      pos: { x: 2.5, y: 2.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 20,
        fireRate: 500,
        accuracy: 90,
        soldierAim: 90,
        attackRange: 5,
        speed: 20,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
      carriedObjectiveId: "artifact-0",
    } as any);

    const engineInternal = engine as any;
    // Add the objective to state
    engineInternal.state.objectives = [
      {
        id: "artifact-0",
        kind: "Recover",
        state: "Pending",
        targetCell: { x: 0, y: 0 },
      },
    ];

    const unit = engineInternal.state.units[0];
    unit.hp = 0;

    engine.update(100);

    const state = engine.getState();
    expect(state.units[0].state).toBe(UnitState.Dead);
    expect(state.loot.length).toBe(1);
    expect(state.loot[0].itemId).toBe("artifact_heavy");
    expect(state.loot[0].objectiveId).toBe("artifact-0");
    expect(state.loot[0].pos.x).toBe(2.5);
    expect(state.loot[0].pos.y).toBe(2.5);
  });

  it("should pick up artifact loot and update unit stats", () => {
    engine.addUnit({
      id: "u1",
      pos: { x: 2.5, y: 2.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 20,
        fireRate: 500,
        accuracy: 90,
        soldierAim: 90,
        attackRange: 10,
        speed: 20,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "assault",
    } as any);

    const engineInternal = engine as any;
    engineInternal.state.objectives = [
      {
        id: "artifact-0",
        kind: "Recover",
        state: "Pending",
        targetCell: { x: 2, y: 2 },
      },
    ];

    engineInternal.lootManager.spawnLoot(
      engineInternal.state,
      "artifact_heavy",
      { x: 2.5, y: 2.5 },
      "artifact-0",
    );

    const lootId = engine.getState().loot[0].id;
    engine.applyCommand({
      type: CommandType.PICKUP,
      unitIds: ["u1"],
      lootId: lootId,
    } as PickupCommand);

    engine.update(100); // Trigger channeling
    expect(engine.getState().units[0].state).toBe(UnitState.Channeling);

    // Channeling duration 1s
    engine.update(1100); // Complete channeling

    const state = engine.getState();
    const unit = state.units[0];
    expect(unit.carriedObjectiveId).toBe("artifact-0");
    // artifact_heavy has speedBonus: -10, accuracyBonus: -15
    // base speed 20 -> 10
    // base accuracy (soldierAim 90 + weapon 0) = 90 -> 75
    expect(unit.stats.speed).toBe(10);
    expect(unit.stats.accuracy).toBe(75);
  });
});
