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
} from "@src/shared/types";

describe("UnitAI Pickup Competition", () => {
  let engine: CoreEngine;
  let mockMap: MapDefinition;
  const defaultSquad: SquadConfig = {
    soldiers: [],
    inventory: {},
  };

  beforeEach(() => {
    // 15x1 floor map
    mockMap = {
      width: 15,
      height: 1,
      cells: [],
      spawnPoints: [],
      extraction: { x: 14, y: 0 },
      objectives: [],
    };
    for (let x = 0; x < 15; x++) {
      mockMap.cells.push({ x, y: 0, type: CellType.Floor });
    }

    engine = new CoreEngine(mockMap, 123, defaultSquad, true, false);
    engine.clearUnits();
  });

  it("should ensure the closest unit claims the loot when multiple units see it", () => {
    // Soldier B (Farther, but added first so it's processed first)
    engine.addUnit({
      id: "soldier-B",
      archetypeId: "assault",
      pos: { x: 10.5, y: 0.5 },
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

    // Soldier A (Closer)
    engine.addUnit({
      id: "soldier-A",
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

    // Add loot at (0, 0)
    const actualState = (engine as any).state;
    (engine as any).lootManager.spawnLoot(actualState, "medkit", {
      x: 0.5,
      y: 0.5,
    });

    expect(actualState.loot.length).toBe(1);
    const lootId = actualState.loot[0].id;

    // Run one update to trigger AI processing
    engine.update(100);

    const currentState = engine.getState();
    const soldierA = currentState.units.find((u) => u.id === "soldier-A")!;
    const soldierB = currentState.units.find((u) => u.id === "soldier-B")!;

    // Soldier A should have claimed it because it's closer (dist 2 vs dist 10)
    expect(soldierA.activeCommand?.type).toBe(CommandType.PICKUP);
    expect((soldierA.activeCommand as PickupCommand).lootId).toBe(lootId);

    // Soldier B should NOT have claimed it
    expect(soldierB.activeCommand?.type).not.toBe(CommandType.PICKUP);
  });

  it("should ensure the closest unit claims the objective when multiple units see it", () => {
    // Soldier B (Farther, added first)
    engine.addUnit({
      id: "soldier-B",
      archetypeId: "assault",
      pos: { x: 10.5, y: 0.5 },
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

    // Soldier A (Closer)
    engine.addUnit({
      id: "soldier-A",
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

    // Add recover objective at (0, 0)
    const actualState = (engine as any).state;
    actualState.objectives.push({
      id: "obj-1",
      kind: "Recover",
      state: "Pending",
      targetCell: { x: 0, y: 0 },
      visible: true,
    });

    // Ensure visibility info is updated so units can "see" it
    actualState.visibleCells.push("0,0");

    // Run one update
    engine.update(100);

    const currentState = engine.getState();
    const soldierA = currentState.units.find((u) => u.id === "soldier-A")!;
    const soldierB = currentState.units.find((u) => u.id === "soldier-B")!;

    // Soldier A should have claimed it
    expect(soldierA.activeCommand?.type).toBe(CommandType.PICKUP);
    expect((soldierA.activeCommand as PickupCommand).lootId).toBe("obj-1");

    // Soldier B should NOT have claimed it
    expect(soldierB.activeCommand?.type).not.toBe(CommandType.PICKUP);
  });
});
