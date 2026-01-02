import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  MissionType,
  AIProfile,
} from "../../shared/types";

describe("Unit Command State UI Tracking", () => {
  let engine: CoreEngine;
  const map: MapDefinition = {
    width: 20,
    height: 20,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 2, y: 0, type: CellType.Floor },
      { x: 3, y: 0, type: CellType.Floor },
      { x: 4, y: 0, type: CellType.Floor },
      { x: 5, y: 0, type: CellType.Floor }, // This one will be undiscovered initially
    ],
    extraction: { x: 0, y: 0 },
  };

  beforeEach(() => {
    engine = new CoreEngine(
      map,
      123,
      { soldiers: [{ archetypeId: "assault" }], inventory: {} },
      false,
      false,
    );
  });

  it("should set activeCommand and label for manual MOVE_TO", () => {
    const unit = engine.getState().units[0];
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [unit.id],
      target: { x: 1, y: 0 },
      label: "Manual Move",
    });

    const updatedUnit = engine.getState().units[0];
    expect(updatedUnit.activeCommand).toBeDefined();
    expect(updatedUnit.activeCommand?.type).toBe(CommandType.MOVE_TO);
    expect(updatedUnit.activeCommand?.label).toBe("Manual Move");
  });

  it("should clear activeCommand when unit becomes Idle", () => {
    const unit = engine.getState().units[0];
    // Move to current position should immediately result in Idle
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [unit.id],
      target: { x: Math.floor(unit.pos.x), y: Math.floor(unit.pos.y) },
    });

    const updatedUnit = engine.getState().units[0];
    expect(updatedUnit.state).toBe(UnitState.Idle);
    expect(updatedUnit.activeCommand).toBeUndefined();
  });

  it("should set activeCommand for autonomous exploration", () => {
    // Enable agent control
    // We need to make sure the unit doesn't see all cells.
    const longMap: MapDefinition = {
      width: 50,
      height: 2,
      cells: [],
      extraction: { x: 0, y: 0 },
      objectives: [
        {
          id: "obj_explore",
          kind: "Recover",
          targetCell: { x: 99, y: 0 },
        },
      ],
    };
    for (let i = 0; i < 30; i++) {
      longMap.cells.push({
        x: i,
        y: 0,
        type: i === 1 ? CellType.Wall : CellType.Floor,
      });
      longMap.cells.push({ x: i, y: 1, type: CellType.Floor });
    }

    engine = new CoreEngine(
      longMap,
      123,
      { soldiers: [], inventory: {} },
      true,
      false,
    );

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
        fireRate: 500,
        accuracy: 1000,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 2,
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      aiEnabled: true,
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });

    (engine as any).state.discoveredCells = ["0,0"];

    // Tick engine to trigger AI
    engine.update(100);
    engine.update(100);

    const unit = engine.getState().units[0];

    expect(unit.activeCommand).toBeDefined();
    expect(unit.activeCommand?.label).toBe("Exploring");
  });

  it("should clear activeCommand on STOP command", () => {
    const unit = engine.getState().units[0];
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: [unit.id],
      target: { x: 1, y: 0 },
    });

    expect(engine.getState().units[0].activeCommand).toBeDefined();

    engine.applyCommand({
      type: CommandType.STOP,
      unitIds: [unit.id],
    });

    expect(engine.getState().units[0].activeCommand).toBeUndefined();
  });
});
