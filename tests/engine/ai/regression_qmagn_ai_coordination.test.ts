import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  AIProfile,
  CommandType,
} from "@src/shared/types";
import { Logger, LogLevel } from "@src/shared/Logger";

describe("AI Coordination (Y-Split)", () => {
  // Y-map:
  // (0,5)-(2,5) corridor
  // (3,4) room A cell
  // (3,6) room B cell
  const yMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [
      { x: 0, y: 5, type: CellType.Floor },
      { x: 1, y: 5, type: CellType.Floor },
      { x: 2, y: 5, type: CellType.Floor },
      { x: 3, y: 5, type: CellType.Floor }, // Junction
      { x: 3, y: 4, type: CellType.Floor }, // Room A start
      { x: 4, y: 4, type: CellType.Floor }, // Room A deep
      { x: 3, y: 6, type: CellType.Floor }, // Room B start
      { x: 4, y: 6, type: CellType.Floor }, // Room B deep
    ],
    doors: [
        {
            id: "doorA",
            segment: [{ x: 3, y: 5 }, { x: 3, y: 4 }],
            orientation: "Horizontal",
            state: "Closed",
            hp: 100,
            maxHp: 100,
            openDuration: 1,
        },
        {
            id: "doorB",
            segment: [{ x: 3, y: 5 }, { x: 3, y: 6 }],
            orientation: "Horizontal",
            state: "Closed",
            hp: 100,
            maxHp: 100,
            openDuration: 1,
        },
    ],
    spawnPoints: [],
    extraction: { x: 0, y: 0 },
  };

  let engine: CoreEngine;

  beforeEach(() => {
    Logger.setLevel(LogLevel.DEBUG);
    engine = new CoreEngine(
      yMap,
      123,
      { soldiers: [], inventory: {} },
      true,
      false,
    );
    engine.clearUnits();
  });

  it("Scenario B: Coordinated Split - Units should target different rooms", () => {
    engine.addUnit({
        id: "u1",
        pos: { x: 0.5, y: 5.5 },
        hp: 100, maxHp: 100,
        state: UnitState.Idle,
        stats: { damage: 10, fireRate: 100, accuracy: 1000, soldierAim: 90, equipmentAccuracyBonus: 0, attackRange: 10, speed: 1.0 },
        aiProfile: AIProfile.STAND_GROUND,
        commandQueue: [], engagementPolicy: "ENGAGE", archetypeId: "scout", kills: 0, damageDealt: 0, objectivesCompleted: 0,
    });
    engine.addUnit({
        id: "u2",
        pos: { x: 0.6, y: 5.5 }, // Slightly offset
        hp: 100, maxHp: 100,
        state: UnitState.Idle,
        stats: { damage: 10, fireRate: 100, accuracy: 1000, soldierAim: 90, equipmentAccuracyBonus: 0, attackRange: 10, speed: 1.0 },
        aiProfile: AIProfile.STAND_GROUND,
        commandQueue: [], engagementPolicy: "ENGAGE", archetypeId: "scout", kills: 0, damageDealt: 0, objectivesCompleted: 0,
    });

    // Start exploration
    engine.applyCommand({ type: CommandType.EXPLORE, unitIds: ["u1", "u2"] });

    // Run for a few ticks to allow AI to make decisions
    for(let i = 0; i < 5; i++) {
        engine.update(100);
    }

    const state = engine.getState();
    const u1 = state.units.find(u => u.id === "u1")!;
    const u2 = state.units.find(u => u.id === "u2")!;

    expect(u1.explorationTarget).toBeDefined();
    expect(u2.explorationTarget).toBeDefined();

    // They should be targeting different rooms (Y-branches)
    // One should target y=4, other y=6 (or deeper cells)
    expect(u1.explorationTarget!.y).not.toBe(u2.explorationTarget!.y);
  });
});
