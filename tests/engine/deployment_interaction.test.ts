import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CommandType,
  MissionType,
  EngineMode,
  CellType,
  SquadConfig,
} from "@src/shared/types";

describe("Deployment Validation and Interaction", () => {
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
      { id: "s1", archetypeId: "assault", name: "Soldier 1" },
      { id: "s2", archetypeId: "medic", name: "Soldier 2" },
    ],
    inventory: {},
  };

  let engine: CoreEngine;

  beforeEach(() => {
    engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      false, // allowTacticalPause
      false, // debugOverlayEnabled
      MissionType.Default,
      false, // isCampaign
      0, // missionDepth
      1.0, // enemyGrowthPerMission
      false, // isSlowMotion
      EngineMode.Simulation,
      [], // initialCommandLog
      true, // isNewGame
      0, // startTick
      3, // baseEnemyCount
      1, // spawnPointCount
      0, // bonusLootCount
      "Combat", // missionNodeCategory
      undefined, // missionId
      undefined, // seed
      false, // skipDeployment = false
    );
  });

  it("should allow deploying a unit to a valid squad spawn point", () => {
    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "s1",
      target: { x: 3.5, y: 1.5 }, // squadSpawns[2] is {x: 3, y: 1}
    });

    const unit = engine.getState().units.find((u) => u.id === "s1")!;
    expect(unit.pos.x).toBe(3.5);
    expect(unit.pos.y).toBe(1.5);
  });

  it("should block deploying a unit to a non-spawn floor cell", () => {
    const unitBefore = engine.getState().units.find((u) => u.id === "s1")!;
    const originalPos = { ...unitBefore.pos };

    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "s1",
      target: { x: 0.5, y: 0.5 }, // Floor but not a spawn point
    });

    const unitAfter = engine.getState().units.find((u) => u.id === "s1")!;
    expect(unitAfter.pos.x).toBe(originalPos.x);
    expect(unitAfter.pos.y).toBe(originalPos.y);
  });

  it("should swap positions when deploying to an occupied spawn point", () => {
    // Initial positions: s1 at (1.5, 1.5), s2 at (2.5, 1.5) due to deterministic spawn
    const s1 = engine.getState().units.find((u) => u.id === "s1")!;
    const s2 = engine.getState().units.find((u) => u.id === "s2")!;
    const s1PosBefore = { ...s1.pos };
    const s2PosBefore = { ...s2.pos };

    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "s1",
      target: s2PosBefore,
    });

    const s1After = engine.getState().units.find((u) => u.id === "s1")!;
    const s2After = engine.getState().units.find((u) => u.id === "s2")!;

    expect(s1After.pos.x).toBe(s2PosBefore.x);
    expect(s1After.pos.y).toBe(s2PosBefore.y);
    expect(s2After.pos.x).toBe(s1PosBefore.x);
    expect(s2After.pos.y).toBe(s1PosBefore.y);
  });

  it("should ignore deployment commands for VIP units", () => {
    // We need a map with a VIP to test this properly
    const escortEngine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      false,
      false,
      MissionType.EscortVIP,
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
      false,
    );

    const vip = escortEngine
      .getState()
      .units.find((u) => u.archetypeId === "vip")!;
    const originalVipPos = { ...vip.pos };

    escortEngine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: vip.id,
      target: { x: 1.5, y: 1.5 },
    });

    const vipAfter = escortEngine
      .getState()
      .units.find((u) => u.id === vip.id)!;
    expect(vipAfter.pos.x).toBe(originalVipPos.x);
    expect(vipAfter.pos.y).toBe(originalVipPos.y);
  });

  it("should correctly validate squadSpawn (singular) property", () => {
    const singularMap: MapDefinition = {
      width: 5,
      height: 5,
      cells: Array.from({ length: 25 }, (_, i) => ({
        x: i % 5,
        y: Math.floor(i / 5),
        type: CellType.Floor,
      })),
      squadSpawn: { x: 4, y: 4 },
      extraction: { x: 0, y: 0 },
    };

    const singularEngine = new CoreEngine(
      singularMap,
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
      false,
    );

    singularEngine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "s1",
      target: { x: 4.5, y: 4.5 },
    });

    const unit = singularEngine.getState().units.find((u) => u.id === "s1")!;
    expect(unit.pos.x).toBe(4.5);
    expect(unit.pos.y).toBe(4.5);
  });

  it("should trigger auto-exploration on START_MISSION for AI enabled units", () => {
    engine.applyCommand({
      type: CommandType.START_MISSION,
    });

    expect(engine.getState().status).toBe("Playing");

    // Check if units have an active command (EXPLORE)
    engine.getState().units.forEach((unit) => {
      if (unit.archetypeId !== "vip" && unit.aiEnabled) {
        expect(unit.activeCommand).toBeDefined();
        expect(unit.activeCommand?.type).toBe(CommandType.EXPLORE);
      }
    });
  });

  it("should ignore DEPLOY_UNIT if unitId is invalid", () => {
    const stateBefore = JSON.stringify(engine.getState().units);

    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "non-existent",
      target: { x: 1.5, y: 1.5 },
    });

    expect(JSON.stringify(engine.getState().units)).toBe(stateBefore);
  });
});
