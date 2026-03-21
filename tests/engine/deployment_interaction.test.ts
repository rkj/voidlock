import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { MathUtils } from "@src/shared/utils/MathUtils";
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
    engine = new CoreEngine({
      map: mockMap,
      seed: 123,
      squadConfig: squadConfig,
      agentControlEnabled: false,
      debugOverlayEnabled: // allowTacticalPause
      false,
      missionType: // debugOverlayEnabled
      MissionType.Default,
      losOverlayEnabled: false,
      startingThreatLevel: // isCampaign
      0,
      initialTimeScale: // missionDepth
      1.0,
      startPaused: // enemyGrowthPerMission
      false,
      mode: // isSlowMotion
      EngineMode.Simulation,
      initialCommandLog: [],
      allowTacticalPause: // initialCommandLog
      true,
      targetTick: // isNewGame
      0,
      baseEnemyCount: // startTick
      3,
      enemyGrowthPerMission: // baseEnemyCount
      1,
      missionDepth: // spawnPointCount
      0,
      nodeType: // bonusLootCount
      "Combat",
      campaignNodeId: // missionNodeCategory
      undefined,
      startingPoints: // missionId
      undefined,
      skipDeployment: // seed
      false,
      debugSnapshots: // skipDeployment = false
    });
  });

  it("should allow deploying a unit to a valid squad spawn point", () => {
    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "s1",
      target: { x: 3.5, y: 1.5 }, // squadSpawns[2] is {x: 3, y: 1}
    });

    const unit = engine.getState().units.find((u) => u.id === "s1")!;
    // s1 (Tactical 1, jitter -0.2, -0.2) at cell (3,1) -> (3.3, 1.3)
    expect(unit.pos.x).toBe(3.3);
    expect(unit.pos.y).toBe(1.3);
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

  it("should allow overlapping positions when deploying to an occupied spawn point", () => {
    // Initial positions: s1 at (1.3, 1.3), s2 at (2.7, 1.3)
    // UnitSpawner uses jitter: Tactical 1 -> (-0.2,-0.2), Tactical 2 -> (0.2,-0.2)
    // spawns[0] is (1,1) -> s1 pos (1.3, 1.3)
    // spawns[1] is (2,1) -> s2 pos (2.7, 1.3)
    const s1 = engine.getState().units.find((u) => u.id === "s1")!;
    const s2 = engine.getState().units.find((u) => u.id === "s2")!;

    const s1PosBefore = { ...s1.pos };
    const s2PosBefore = { ...s2.pos };

    expect(s1PosBefore).toEqual({ x: 1.3, y: 1.3 });
    expect(s2PosBefore).toEqual({ x: 2.7, y: 1.3 });

    // Deploy s1 onto s2's position (cell 2,1)
    engine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "s1",
      target: s2PosBefore,
    });

    const s1After = engine.getState().units.find((u) => u.id === "s1")!;
    const s2After = engine.getState().units.find((u) => u.id === "s2")!;

    // s1 after move to cell (2,1) -> (2.3, 1.3) [Tactical 1 jitter -0.2]
    // s2 stays at cell (2,1) -> (2.7, 1.3) [Tactical 2 jitter +0.2]
    expect(s1After.pos).toEqual({ x: 2.3, y: 1.3 });
    expect(s2After.pos).toEqual({ x: 2.7, y: 1.3 });
  });

  it("should swap positions when deploying to a full spawn point (4 units)", () => {
    const fullSquadConfig: SquadConfig = {
      soldiers: [
        { id: "s1", archetypeId: "assault", name: "S1" },
        { id: "s2", archetypeId: "medic", name: "S2" },
        { id: "s3", archetypeId: "scout", name: "S3" },
        { id: "s4", archetypeId: "heavy", name: "S4" },
        { id: "s5", archetypeId: "assault", name: "S5" },
      ],
      inventory: {},
    };

    const fullEngine = new CoreEngine({
      map: mockMap,
      seed: 123,
      squadConfig: fullSquadConfig,
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
      missionDepth: 0,
      nodeType: "Combat",
      campaignNodeId: undefined,
      startingPoints: undefined,
      skipDeployment: false
    });

    // Deploy s1, s4, s5, s2 to spawns[0] to fill it up (4 units)
    fullEngine.applyCommand({ type: CommandType.DEPLOY_UNIT, unitId: "s1", target: { x: 1.5, y: 1.5 } });
    fullEngine.applyCommand({ type: CommandType.DEPLOY_UNIT, unitId: "s4", target: { x: 1.5, y: 1.5 } });
    fullEngine.applyCommand({ type: CommandType.DEPLOY_UNIT, unitId: "s5", target: { x: 1.5, y: 1.5 } });
    fullEngine.applyCommand({ type: CommandType.DEPLOY_UNIT, unitId: "s2", target: { x: 1.5, y: 1.5 } });

    // Deploy s3 to spawns[2] first
    fullEngine.applyCommand({ type: CommandType.DEPLOY_UNIT, unitId: "s3", target: { x: 3.5, y: 1.5 } });
    const s3PosBefore = { ...fullEngine.getState().units.find(u => u.id === "s3")!.pos };

    // Now deploy s3 onto spawns[0]. It should swap with the first occupant (s1).
    fullEngine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "s3",
      target: { x: 1.5, y: 1.5 },
    });

    const s3After = fullEngine.getState().units.find(u => u.id === "s3")!;
    const s1After = fullEngine.getState().units.find(u => u.id === "s1")!;

    expect(MathUtils.toCellCoord(s3After.pos)).toEqual({ x: 1, y: 1 });
    expect(MathUtils.toCellCoord(s1After.pos)).toEqual(MathUtils.toCellCoord(s3PosBefore));
  });


  it("should ignore deployment commands for VIP units", () => {
    // We need a map with a VIP to test this properly
    const escortEngine = new CoreEngine({
      map: mockMap,
      seed: 123,
      squadConfig: squadConfig,
      agentControlEnabled: false,
      debugOverlayEnabled: false,
      missionType: MissionType.EscortVIP,
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
      missionDepth: 0,
      nodeType: "Combat",
      campaignNodeId: undefined,
      startingPoints: undefined,
      skipDeployment: false
    });

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

    const singularEngine = new CoreEngine({
      map: singularMap,
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
      missionDepth: 0,
      nodeType: "Combat",
      campaignNodeId: undefined,
      startingPoints: undefined,
      skipDeployment: false
    });

    singularEngine.applyCommand({
      type: CommandType.DEPLOY_UNIT,
      unitId: "s1",
      target: { x: 4.5, y: 4.5 },
    });

    const unit = singularEngine.getState().units.find((u) => u.id === "s1")!;
    // s1 (Tactical 1, jitter -0.2, -0.2) at cell (4,4) -> (4.3, 4.3)
    expect(unit.pos.x).toBe(4.3);
    expect(unit.pos.y).toBe(4.3);
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
