import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  PickupCommand,
  SquadConfig,
  AIProfile,
} from "@src/shared/types";

describe("Regression voidlock-v8kk: Multiple units picking up same item", () => {
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
  });

  it("should not allow second unit to start channeling if another unit is already channeling", () => {
    engine.addUnit({
      id: "u1",
      archetypeId: "assault",
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
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      aiEnabled: true,
    });
    engine.addUnit({
      id: "u2",
      archetypeId: "assault",
      pos: { x: 2.5, y: 1.5 },
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

    const actualState = (engine as any).state;
    (engine as any).lootManager.spawnLoot(actualState, "medkit", {
      x: 3.5,
      y: 0.5,
    });

    let u1Channeling = false;
    let u2Channeling = false;
    let overlapDetected = false;

    for (let i = 0; i < 50; i++) {
      engine.update(112);
      const currentState = engine.getState();
      const u1 = currentState.units.find((u) => u.id === "u1")!;
      const u2 = currentState.units.find((u) => u.id === "u2")!;

      if (
        u1.state === UnitState.Channeling &&
        u1.channeling?.action === "Pickup"
      ) {
        u1Channeling = true;
      }
      if (
        u2.state === UnitState.Channeling &&
        u2.channeling?.action === "Pickup"
      ) {
        u2Channeling = true;
      }

      if (u1Channeling && u2Channeling) {
        overlapDetected = true;
        break;
      }
    }

    expect(overlapDetected).toBe(false);
  });

  it("should not allow autonomous unit to target item being manually picked up (after channeling starts)", () => {
    // Unit 1: Manual pickup
    engine.addUnit({
      id: "u1",
      archetypeId: "assault",
      pos: { x: 3.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        speed: 20,
        damage: 10,
        fireRate: 100,
        accuracy: 1000,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 5,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      aiEnabled: true, // Initially true, will become false on manual command
    });
    // Unit 2: Autonomous
    engine.addUnit({
      id: "u2",
      archetypeId: "assault",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        speed: 20,
        damage: 10,
        fireRate: 100,
        accuracy: 1000,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 5,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      aiEnabled: true,
    });

    const actualState = (engine as any).state;
    const lootId = "loot-1";
    actualState.loot = [
      {
        id: lootId,
        itemId: "medkit",
        pos: { x: 3.5, y: 0.5 },
      },
    ];

    // Manually issue pickup command to u1
    engine.applyCommand({
      type: CommandType.PICKUP,
      unitIds: ["u1"],
      lootId: lootId,
    });

    // Run a few ticks. u1 should start channeling and aiEnabled should be false.
    // u1 has commandQueue: [RESUME_AI], so it's NOT "capable" for item assignments.
    for (let i = 0; i < 5; i++) {
      engine.update(112);
    }

    let state = engine.getState();
    const u1 = state.units.find((u) => u.id === "u1")!;
    expect(u1.state).toBe(UnitState.Channeling);
    expect(u1.aiEnabled).toBe(false);
    expect(u1.commandQueue.length).toBe(1); // RESUME_AI
    expect(u1.activeCommand).toBeUndefined(); // InteractionBehavior clears it

    // Now u2 should NOT target the lootId, even though u1's activeCommand is undefined
    // because u1 is still channeling it.

    let u2TargetingLoot = false;
    for (let i = 0; i < 10; i++) {
      engine.update(112);
      state = engine.getState();
      const u2 = state.units.find((u) => u.id === "u2")!;
      if (
        u2.activeCommand?.type === CommandType.PICKUP &&
        (u2.activeCommand as PickupCommand).lootId === lootId
      ) {
        u2TargetingLoot = true;
        break;
      }
    }

    expect(u2TargetingLoot).toBe(false);
  });

  it("should stop channeling if the item is picked up by someone else", () => {
    // This test might be harder to set up purely autonomously
    // because u2 shouldn't even start if u1 is already there.
    // But we can manually issue commands.

    engine.addUnit({
      id: "u1",
      archetypeId: "assault",
      pos: { x: 3.5, y: 0.5 }, // Right on top of loot
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
      aiEnabled: false, // Manual control for u1
    });
    engine.addUnit({
      id: "u2",
      archetypeId: "assault",
      pos: { x: 3.5, y: 0.5 }, // Also right on top
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
      aiEnabled: false, // Manual control for u2
    });

    const actualState = (engine as any).state;
    const lootId = "loot-1";
    actualState.loot = [
      {
        id: lootId,
        itemId: "medkit",
        pos: { x: 3.5, y: 0.5 },
      },
    ];

    // Manually issue pickup commands
    engine.applyCommand({
      type: CommandType.PICKUP,
      unitIds: ["u1"],
      lootId: lootId,
    });
    engine.applyCommand({
      type: CommandType.PICKUP,
      unitIds: ["u2"],
      lootId: lootId,
    });

    // Update once to start channeling for both
    engine.update(16);

    let state = engine.getState();
    const u1 = state.units.find((u) => u.id === "u1")!;
    const u2 = state.units.find((u) => u.id === "u2")!;

    expect(u1.state).toBe(UnitState.Channeling);
    expect(u2.state).toBe(UnitState.Channeling);

    // Speed up u1's channeling by manually reducing remaining time
    (engine as any).state.units[0].channeling.remaining = 0.01;

    // Update again. u1 should finish and remove loot.
    engine.update(64);

    state = engine.getState();
    expect(state.loot.length).toBe(0);

    const u2_after = state.units.find((u) => u.id === "u2")!;
    // u2 should now be Idle, NOT Channeling anymore because item is gone
    expect(u2_after.state).toBe(UnitState.Idle);
    expect(u2_after.channeling).toBeUndefined();
  });
});
