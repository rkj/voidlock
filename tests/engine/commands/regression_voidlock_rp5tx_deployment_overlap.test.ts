import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CommandType,
  MissionType,
  EngineMode,
  CellType,
} from "@src/shared/types";
import { MathUtils } from "@src/shared/utils/MathUtils";

describe("Deployment Overlap Limit Regression", () => {
  const mockMap: MapDefinition = {
    width: 4,
    height: 4,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 2, y: 0, type: CellType.Floor },
      { x: 3, y: 0, type: CellType.Floor },
    ],
    squadSpawns: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
  };

  const squadConfig = {
    soldiers: [
      { id: "unit-1", archetypeId: "assault" },
      { id: "unit-2", archetypeId: "assault" },
      { id: "unit-3", archetypeId: "assault" },
      { id: "unit-4", archetypeId: "assault" },
    ],
    inventory: {},
  };

  let engine: CoreEngine;

  beforeEach(() => {
    engine = new CoreEngine({
      map: mockMap,
      seed: 123,
      squadConfig: squadConfig,
      agentControlEnabled: false,
      debugOverlayEnabled: false,
      missionType: MissionType.Default,
      losOverlayEnabled: false,
      startingThreatLevel: 0,
      initialTimeScale: 1.0,
      startPaused: false,
      mode: EngineMode.Simulation,
      initialCommandLog: [],
      allowTacticalPause: true,
      targetTick: 0,
      baseEnemyCount: 3,
      enemyGrowthPerMission: 1,
      missionDepth: 0, nodeType: "Combat",
      campaignNodeId: undefined,
      startingPoints: undefined,
      skipDeployment: false,
      debugSnapshots: false
    });
  });

  it("should allow up to 4 soldiers to be deployed on the same spawn point", () => {
    const target = { x: 0.5, y: 0.5 }; // Target is the first spawn point (0, 0)

    // Move all units to the target spawn point
    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "unit-1",
      target,
    });

    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "unit-2",
      target,
    });

    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "unit-3",
      target,
    });

    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "unit-4",
      target,
    });

    const state = engine.getState();
    const unit1 = state.units.find((u) => u.id === "unit-1")!;
    const unit2 = state.units.find((u) => u.id === "unit-2")!;
    const unit3 = state.units.find((u) => u.id === "unit-3")!;
    const unit4 = state.units.find((u) => u.id === "unit-4")!;

    // We expect ALL FOUR to be deployed at (0, 0)
    expect(MathUtils.toCellCoord(unit1.pos)).toEqual({ x: 0, y: 0 });
    expect(MathUtils.toCellCoord(unit2.pos)).toEqual({ x: 0, y: 0 });
    expect(MathUtils.toCellCoord(unit3.pos)).toEqual({ x: 0, y: 0 });
    expect(MathUtils.toCellCoord(unit4.pos)).toEqual({ x: 0, y: 0 });
  });
});
