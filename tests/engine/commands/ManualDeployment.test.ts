import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { MapDefinition, CommandType, MissionType, EngineMode, CellType } from "@src/shared/types";

describe("Manual Deployment Phase", () => {
  const mockMap: MapDefinition = {
    width: 5,
    height: 5,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 2, y: 0, type: CellType.Floor },
      { x: 0, y: 1, type: CellType.Floor },
      { x: 1, y: 1, type: CellType.Floor },
      { x: 2, y: 1, type: CellType.Floor },
    ],
    squadSpawns: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ],
  };

  const squadConfig = {
    soldiers: [
      { id: "unit-1", archetypeId: "assault" },
      { id: "unit-2", archetypeId: "assault" },
    ],
    inventory: {},
  };

  let engine: CoreEngine;

  beforeEach(() => {
    engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      false,
      false,
      MissionType.Default,
      false,
      0,
      1.0,
      false,
      EngineMode.Simulation,
      [],
      true,
      0,
      3,
      1,
      0,
      "Combat",
      undefined,
      undefined,
      false, // skipDeployment = false
    );
  });

  it("starts in Deployment status", () => {
    const state = engine.getState();
    expect(state.status).toBe("Deployment");
  });

  it("does not process movement/combat in Deployment status", () => {
    engine.update(100);
    const state = engine.getState();
    expect(state.t).toBe(0); // Time should not advance
  });

  it("allows moving a unit to a valid spawn tile", () => {
    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "unit-1",
      target: { x: 2.5, y: 0.5 },
    });

    const state = engine.getState();
    const unit1 = state.units.find(u => u.id === "unit-1")!;
    expect(Math.floor(unit1.pos.x)).toBe(2);
    expect(Math.floor(unit1.pos.y)).toBe(0);
  });

  it("prevents moving a unit to an invalid tile", () => {
    const stateBefore = engine.getState();
    const unit1Before = stateBefore.units.find(u => u.id === "unit-1")!;
    const originalPos = { ...unit1Before.pos };

    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "unit-1",
      target: { x: 1.5, y: 1.5 }, // Not a spawn tile
    });

    const stateAfter = engine.getState();
    const unit1After = stateAfter.units.find(u => u.id === "unit-1")!;
    expect(unit1After.pos.x).toBe(originalPos.x);
    expect(unit1After.pos.y).toBe(originalPos.y);
  });

  it("swaps units when deploying to an occupied tile", () => {
    // Force set positions to known tiles
    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "unit-1",
      target: { x: 0.5, y: 0.5 },
    });
    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "unit-2",
      target: { x: 1.5, y: 0.5 },
    });

    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "unit-1",
      target: { x: 1.5, y: 0.5 }, // Targeted occupied tile
    });

    const state = engine.getState();
    const unit1 = state.units.find(u => u.id === "unit-1")!;
    const unit2 = state.units.find(u => u.id === "unit-2")!;

    expect(Math.floor(unit1.pos.x)).toBe(1);
    expect(Math.floor(unit2.pos.x)).toBe(0);
  });

  it("starts the mission when START_MISSION is received", () => {
    engine.applyCommand({
      type: CommandType.START_MISSION,
    });

    const state = engine.getState();
    expect(state.status).toBe("Playing");

    engine.update(100);
    expect(engine.getState().t).toBe(100);
  });
});