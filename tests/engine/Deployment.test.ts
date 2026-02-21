import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  CommandType,
  SquadConfig,
} from "@src/shared/types";

describe("Deployment Phase", () => {
  const mockMap: MapDefinition = {
    width: 5,
    height: 5,
    cells: Array.from({ length: 25 }, (_, i) => ({
      x: i % 5,
      y: Math.floor(i / 5),
      type: CellType.Floor,
    })),
    squadSpawns: [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ],
    extraction: { x: 0, y: 0 },
  };

  const squadConfig: SquadConfig = {
    soldiers: [
      { id: "s1", archetypeId: "assault" },
      { id: "s2", archetypeId: "medic" },
    ],
    inventory: {},
  };

  it("should start in Deployment status", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      false,
      false,
      undefined,
      undefined,
      0,
      1.0,
      false,
      undefined,
      [],
      true,
      0,
      3,
      1,
      0,
      "Combat",
      undefined,
      undefined,
      false,
    );
    expect(engine.getState().status).toBe("Deployment");
  });

  it("should NOT update time during Deployment", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      false,
      false,
      undefined,
      undefined,
      0,
      1.0,
      false,
      undefined,
      [],
      true,
      0,
      3,
      1,
      0,
      "Combat",
      undefined,
      undefined,
      false,
    );
    engine.update(100);
    expect(engine.getState().t).toBe(0);
  });

  it("should allow moving units during Deployment", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      false,
      false,
      undefined,
      undefined,
      0,
      1.0,
      false,
      undefined,
      [],
      true,
      0,
      3,
      1,
      0,
      "Combat",
      undefined,
      undefined,
      false,
    );
    const unit1 = engine.getState().units.find((u) => u.id === "s1")!;
    const originalPos = { ...unit1.pos };

    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "s1",
      target: { x: 2.5, y: 1.5 },
    });

    const unit1After = engine.getState().units.find((u) => u.id === "s1")!;
    expect(unit1After.pos.x).toBe(2.3);
    expect(unit1After.pos.y).toBe(1.3);
    expect(unit1After.pos).not.toEqual(originalPos);
  });

  it("should swap units when deploying onto an occupied tile", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      false,
      false,
      undefined,
      undefined,
      0,
      1.0,
      false,
      undefined,
      [],
      true,
      0,
      3,
      1,
      0,
      "Combat",
      undefined,
      undefined,
      false,
    );

    // Manually place s1 at cell (1, 1) and s2 at cell (2, 1)
    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "s1",
      target: { x: 1.5, y: 1.5 },
    });
    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "s2",
      target: { x: 2.5, y: 1.5 },
    });

    // s1 (Tactical 1, jitter -0.2, -0.2) at (1,1) -> (1.3, 1.3)
    // s2 (Tactical 2, jitter 0.2, -0.2) at (2,1) -> (2.7, 1.3)
    const s1Pos = { x: 1.3, y: 1.3 };
    const s2Pos = { x: 2.7, y: 1.3 };

    expect(engine.getState().units.find((u) => u.id === "s1")!.pos).toEqual(s1Pos);
    expect(engine.getState().units.find((u) => u.id === "s2")!.pos).toEqual(s2Pos);

    // Deploy s1 onto s2's position (cell 2,1)
    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "s1",
      target: s2Pos,
    });

    const s1After = engine.getState().units.find((u) => u.id === "s1")!;
    const s2After = engine.getState().units.find((u) => u.id === "s2")!;

    // s1 after move to cell (2,1) -> (2.3, 1.3)
    // s2 after swap to cell (1,1) -> (1.7, 1.3)
    expect(s1After.pos).toEqual({ x: 2.3, y: 1.3 });
    expect(s2After.pos).toEqual({ x: 1.7, y: 1.3 });
  });

  it("should transition to Playing on START_MISSION", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      false,
      false,
      undefined,
      undefined,
      0,
      1.0,
      false,
      undefined,
      [],
      true,
      0,
      3,
      1,
      0,
      "Combat",
      undefined,
      undefined,
      false,
    );
    engine.applyCommand({ type: CommandType.START_MISSION });
    expect(engine.getState().status).toBe("Playing");

    // Time should now advance
    engine.update(112);
    expect(engine.getState().t).toBe(112);
  });

  it("should reveal spawn points during Deployment", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      false,
      false,
      undefined,
      undefined,
      0,
      1.0,
      false,
      undefined,
      [],
      true,
      0,
      3,
      1,
      0,
      "Combat",
      undefined,
      undefined,
      false,
    );
    const state = engine.getState();

    // squadSpawns: (1,1), (2,1), (3,1)
    expect(state.discoveredCells).toContain("1,1");
    expect(state.discoveredCells).toContain("2,1");
    expect(state.discoveredCells).toContain("3,1");
  });
});
