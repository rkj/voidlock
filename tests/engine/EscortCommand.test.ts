import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  CellType,
  UnitState,
  CommandType,
  SquadConfig,
  AIProfile,
} from "@src/shared/types";

describe("Escort Command", () => {
  let engine: CoreEngine;
  const mockMap = {
    width: 20,
    height: 20,
    cells: Array.from({ length: 400 }, (_, i) => ({
      x: i % 20,
      y: Math.floor(i / 20),
      type: CellType.Floor,
    })),
    spawnPoints: [],
    extraction: { x: 19, y: 19 },
  };

  const addUnit = (id: string, x: number, archetype: string = "assault", speed: number = 20) => {
    engine.addUnit({
      id,
      pos: { x: x + 0.5, y: 5.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 20,
        fireRate: 500,
        accuracy: 90,
        soldierAim: 90,
        attackRange: 5,
        speed,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: archetype,
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });
  };

  beforeEach(() => {
    const squad: SquadConfig = {
      soldiers: [],
      inventory: {},
    };
    engine = new CoreEngine(mockMap as any, 123, squad, false, false);
    engine.clearUnits();

    // Setup target unit (Heavy - Speed 15)
    addUnit("target", 5, "heavy", 15);
    // Setup escort units
    addUnit("escort1", 0);
    addUnit("escort2", 1);
    addUnit("escort3", 2);
  });

  it("should synchronize speed to slower target", () => {
    engine.applyCommand({
      type: CommandType.ESCORT_UNIT,
      unitIds: ["escort1"],
      targetId: "target",
    });

    // Wait to reach formation
    for (let i = 0; i < 50; i++) engine.update(100);

    let state = engine.getState();
    let e1 = state.units.find(u => u.id === "escort1")!;
    let target = state.units.find(u => u.id === "target")!;

    // Escort (20) should match Target (15)
    expect(target.stats.speed).toBe(15);
    expect(e1.stats.speed).toBe(15);
  });

  it("should follow target when it moves", () => {
    engine.applyCommand({
      type: CommandType.ESCORT_UNIT,
      unitIds: ["escort1"],
      targetId: "target",
    });

    for (let i = 0; i < 50; i++) engine.update(100);

    // Move target East
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["target"],
      target: { x: 15, y: 5 },
    });

    // Target speed is 15 (1.5 tiles/s). 
    // From 5.5 to 15.5 is 10 tiles. Takes ~6.7s.
    for (let i = 0; i < 100; i++) engine.update(100);

    const state = engine.getState();
    const target = state.units.find(u => u.id === "target")!;
    const e1 = state.units.find(u => u.id === "escort1")!;

    expect(Math.floor(target.pos.x)).toBeGreaterThanOrEqual(14);
    expect(Math.floor(e1.pos.x)).toBeGreaterThanOrEqual(Math.floor(target.pos.x));
    
    const dist = Math.sqrt(Math.pow(e1.pos.x - target.pos.x, 2) + Math.pow(e1.pos.y - target.pos.y, 2));
    expect(dist).toBeLessThan(3.0); 
  });

  it("should handle multiple bodyguards in formation", () => {
    addUnit("escort4", 3);
    addUnit("escort5", 4);

    engine.applyCommand({
      type: CommandType.ESCORT_UNIT,
      unitIds: ["escort1", "escort2", "escort3", "escort4", "escort5"],
      targetId: "target",
    });

    for (let i = 0; i < 50; i++) engine.update(100);

    const state = engine.getState();
    const e1 = state.units.find(u => u.id === "escort1")!; // Vanguard
    const e2 = state.units.find(u => u.id === "escort2")!; // Rearguard
    const e3 = state.units.find(u => u.id === "escort3")!; // Bodyguard 1 (Right)
    const e4 = state.units.find(u => u.id === "escort4")!; // Bodyguard 2 (Left)
    const e5 = state.units.find(u => u.id === "escort5")!; // Bodyguard 3 (Right, Depth 1)

    expect(Math.floor(e1.pos.x)).toBe(5);
    expect(Math.floor(e1.pos.y)).toBe(4);

    expect(Math.floor(e2.pos.x)).toBe(5);
    expect(Math.floor(e2.pos.y)).toBe(6);

    expect(Math.floor(e3.pos.x)).toBe(6);
    expect(Math.floor(e3.pos.y)).toBe(5);

    expect(Math.floor(e4.pos.x)).toBe(4);
    expect(Math.floor(e4.pos.y)).toBe(5);

    expect(Math.floor(e5.pos.x)).toBe(6);
    expect(Math.floor(e5.pos.y)).toBe(6);
  });
});