import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  SquadConfig,
  MissionType,
  ArchetypeLibrary,
} from "../../shared/types";

describe("VIP AI Behavior", () => {
  const mockMap: MapDefinition = {
    width: 5,
    height: 5,
    cells: Array.from({ length: 25 }, (_, i) => ({
      x: i % 5,
      y: Math.floor(i / 5),
      type: CellType.Floor,
    })),
    squadSpawn: { x: 0, y: 0 },
    extraction: { x: 4, y: 4 },
    objectives: [],
  };

  it("should be locked initially and rescued by a nearby soldier", () => {
    const squadConfig: SquadConfig = [{ archetypeId: "assault", count: 1 }];
    const wallMap: MapDefinition = {
      ...mockMap,
      walls: [
        { p1: { x: 1, y: 0 }, p2: { x: 2, y: 0 } }, // Wall between (1,0) and (2,0)
      ],
    };
    const engine = new CoreEngine(
      wallMap,
      123,
      squadConfig,
      true,
      false,
      MissionType.EscortVIP,
    );

    // Clear and manually place units for predictable test
    engine.clearUnits();

    // VIP at (4,0)
    engine.addUnit({
      id: "vip-1",
      archetypeId: "vip",
      pos: { x: 4.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 0,
      fireRate: 0,
      accuracy: 1000,
      attackRange: 0,
      sightRange: 6,
      speed: 20,
      aiEnabled: false,
      commandQueue: [],
    });

    // Soldier at (0,0)
    engine.addUnit({
      id: "s1",
      archetypeId: "assault",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 20,
      fireRate: 600,
      accuracy: 1000,
      attackRange: 4,
      sightRange: 8,
      speed: 20,
      aiEnabled: true,
      commandQueue: [],
    });

    engine.update(100);
    let state = engine.getState();
    let vip = state.units.find((u) => u.id === "vip-1")!;
    expect(vip.aiEnabled).toBe(false);

    // Move soldier near VIP (past the wall)
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["s1"],
      target: { x: 3, y: 0 },
    });

    // Tick enough to reach and see
    for (let i = 0; i < 40; i++) engine.update(100);

    state = engine.getState();
    vip = state.units.find((u) => u.id === "vip-1")!;
    expect(vip.aiEnabled).toBe(true);
  });

  it("should flee from nearby enemies", () => {
    const squadConfig: SquadConfig = [];
    const engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      true,
      false,
      MissionType.EscortVIP,
    );
    engine.clearUnits();

    // Rescued VIP at (2,2)
    engine.addUnit({
      id: "vip-1",
      archetypeId: "vip",
      pos: { x: 2.5, y: 2.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 0,
      fireRate: 0,
      accuracy: 1000,
      attackRange: 0,
      sightRange: 6,
      speed: 20,
      aiEnabled: true,
      commandQueue: [],
    });

    // Enemy at (2,1)
    engine.addEnemy({
      id: "e1",
      pos: { x: 2.5, y: 1.5 },
      hp: 50,
      maxHp: 50,
      type: "Xeno-Mite",
      damage: 10,
      fireRate: 1000,
      accuracy: 1000,
      attackRange: 1,
      speed: 10,
    });

    // Make sure VIP can see enemy
    const state = engine.getState();
    state.visibleCells.push("2,1");
    // Hack to inject visible cells since engine recalculates them
    // Actually, CoreEngine recalculates visibility every update.
    // In our mock map, everything should be visible if we disable FOW?
    // CoreEngine doesn't have a way to disable FOW easily in constructor for this test.
    // But in this small map, they should see each other.

    engine.update(100);
    const updatedVip = engine.getState().units.find((u) => u.id === "vip-1")!;
    expect(updatedVip.state).toBe(UnitState.Moving);
    expect(updatedVip.activeCommand?.label).toBe("Fleeing");

    // It should move away from (2,1). Current is (2,2).
    // Possible flee targets are (2,3), (2,4) etc.
    expect(updatedVip.targetPos!.y).toBeGreaterThan(2.5);
  });

  it("should prioritize extraction once discovered", () => {
    const squadConfig: SquadConfig = [];
    const engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      true,
      false,
      MissionType.EscortVIP,
    );
    engine.clearUnits();

    // Rescued VIP at (0,0)
    engine.addUnit({
      id: "vip-1",
      archetypeId: "vip",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 0,
      fireRate: 0,
      accuracy: 1000,
      attackRange: 0,
      sightRange: 6,
      speed: 20,
      aiEnabled: true,
      commandQueue: [],
    });

    engine.update(100);
    const updatedVip = engine.getState().units.find((u) => u.id === "vip-1")!;
    expect(updatedVip.state).toBe(UnitState.Moving);
    expect(updatedVip.activeCommand?.label).toBe("Extracting");
  });

  it("should ignore objectives", () => {
    const squadConfig: SquadConfig = [];
    const engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      true,
      false,
      MissionType.Default,
    );
    engine.clearUnits();

    // Rescued VIP at (0,0)
    engine.addUnit({
      id: "vip-1",
      archetypeId: "vip",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 0,
      fireRate: 0,
      accuracy: 1000,
      attackRange: 0,
      sightRange: 6,
      speed: 20,
      aiEnabled: true,
      commandQueue: [],
    });

    // Objective at (1,1)
    engine.getState().objectives.push({
      id: "obj-1",
      kind: "Recover",
      state: "Pending",
      targetCell: { x: 1, y: 1 },
      visible: true,
    });

    engine.update(100);
    const updatedVip = engine.getState().units.find((u) => u.id === "vip-1")!;
    // VIP should be moving to extraction (4,4), NOT the objective (1,1)
    expect(updatedVip.state).toBe(UnitState.Moving);
    expect(updatedVip.activeCommand?.label).toBe("Extracting");
    expect((updatedVip.activeCommand as any).target).toEqual({ x: 4, y: 4 });
  });
});
