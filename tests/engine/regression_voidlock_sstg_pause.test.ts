import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameClient } from "@src/engine/GameClient";
import {
  MapDefinition,
  MapGeneratorType,
  SquadConfig,
  MapGenerationConfig,
  UnitStyle,
  MissionType,
} from "@src/shared/types";
import { MapGenerator } from "@src/engine/MapGenerator";

// Mock Worker
const postMessageMock = vi.fn();
const terminateMock = vi.fn();

class MockWorker {
  onmessage: unknown = null;
  postMessage = postMessageMock;
  terminate = terminateMock;
}

vi.stubGlobal("Worker", MockWorker);

// Mock MapGeneratorFactory
const mockMapGeneratorFactory = (config: MapGenerationConfig) => {
  const generator = new MapGenerator(config);
  generator.generate = vi
    .fn()
    .mockReturnValue({ width: 10, height: 10, cells: [] });
  generator.load = vi
    .fn()
    .mockImplementation((data) => data || { width: 10, height: 10, cells: [] });
  return generator;
};

describe("GameClient Pause Logic (sstg.2)", () => {
  let client: GameClient;
  const mockMap: MapDefinition = { width: 10, height: 10, cells: [] };
  const defaultSquad: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }],
    inventory: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GameClient(mockMapGeneratorFactory);
  });

  it("should use 0.1x for active pause when allowed", () => {
    client.init({
      seed: 12345,
      mapGeneratorType: MapGeneratorType.Procedural,
      map: mockMap,
      agentControlEnabled: true,
      debugOverlayEnabled: false,
      fogOfWarEnabled: true,
      unitStyle: UnitStyle.TacticalIcons,
      themeId: "default",
      squadConfig: defaultSquad,
      missionType: MissionType.Default,
      allowTacticalPause: 16,
      startPaused: 16,
      startingThreatLevel: 3,
      enemyGrowthPerMission: false,
      missionDepth: 0,
      nodeType: 1.0,
      campaignNodeId: // initial scale
      false,
      startingPoints: // startPaused
      true,
      commandLog: // allowTacticalPause
    });

    client.togglePause(); // Should pause
    expect(client.getIsPaused()).toBe(true);
    expect(client.getTimeScale()).toBe(0.1);

    // Verify messages sent to worker
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_PAUSED",
      payload: true,
    });
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_TIME_SCALE",
      payload: 0.1,
    });
  });

  it("should resume to last non-paused scale", () => {
    client.init({
      seed: 12345,
      mapGeneratorType: MapGeneratorType.Procedural,
      map: mockMap,
      agentControlEnabled: true,
      debugOverlayEnabled: false,
      fogOfWarEnabled: true,
      unitStyle: UnitStyle.TacticalIcons,
      themeId: "default",
      squadConfig: defaultSquad,
      missionType: MissionType.Default,
      allowTacticalPause: 16,
      startPaused: 16,
      startingThreatLevel: 3,
      enemyGrowthPerMission: false,
      missionDepth: 0,
      nodeType: 1.0,
      campaignNodeId: false,
      startingPoints: true
    });

    client.setTimeScale(2.0);
    client.togglePause(); // Pause
    expect(client.getTimeScale()).toBe(0.1);

    client.togglePause(); // Resume
    expect(client.getTimeScale()).toBe(2.0);
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_PAUSED",
      payload: false,
    });
    expect(postMessageMock).toHaveBeenCalledWith({
      type: "SET_TIME_SCALE",
      payload: 2.0,
    });
    expect(postMessageMock).toHaveBeenLastCalledWith({
      type: "SET_TARGET_TIME_SCALE",
      payload: 2.0,
    });
  });

  it("should disable togglePause when tactical pause is NOT allowed", () => {
    client.init({
      seed: 12345,
      mapGeneratorType: MapGeneratorType.Procedural,
      map: mockMap,
      agentControlEnabled: true,
      debugOverlayEnabled: false,
      fogOfWarEnabled: true,
      unitStyle: UnitStyle.TacticalIcons,
      themeId: "default",
      squadConfig: defaultSquad,
      missionType: MissionType.Default,
      allowTacticalPause: 16,
      startPaused: 16,
      startingThreatLevel: 3,
      enemyGrowthPerMission: false,
      missionDepth: 0,
      nodeType: 1.0,
      campaignNodeId: false,
      startingPoints: // startPaused
      false,
      commandLog: // allowTacticalPause = FALSE
    });

    client.togglePause();
    expect(client.getIsPaused()).toBe(false);
    expect(client.getTimeScale()).toBe(1.0);
  });

  it("should clamp setTimeScale to 1.0 when tactical pause is NOT allowed", () => {
    client.init({
      seed: 12345,
      mapGeneratorType: MapGeneratorType.Procedural,
      map: mockMap,
      agentControlEnabled: true,
      debugOverlayEnabled: false,
      fogOfWarEnabled: true,
      unitStyle: UnitStyle.TacticalIcons,
      themeId: "default",
      squadConfig: defaultSquad,
      missionType: MissionType.Default,
      allowTacticalPause: 16,
      startPaused: 16,
      startingThreatLevel: 3,
      enemyGrowthPerMission: false,
      missionDepth: 0,
      nodeType: 1.0,
      campaignNodeId: false,
      startingPoints: false,
      commandLog: // allowTacticalPause = FALSE
    });

    client.setTimeScale(0.5);
    expect(client.getTimeScale()).toBe(1.0);

    client.setTimeScale(5.0);
    expect(client.getTimeScale()).toBe(5.0);

    client.setTimeScale(20.0);
    expect(client.getTimeScale()).toBe(10.0);
  });

  it("should return 0.1 for getTimeScale when paused and tactical allowed", () => {
    client.init({
      seed: 12345,
      mapGeneratorType: MapGeneratorType.Procedural,
      map: mockMap,
      agentControlEnabled: true,
      debugOverlayEnabled: false,
      fogOfWarEnabled: true,
      unitStyle: UnitStyle.TacticalIcons,
      themeId: "default",
      squadConfig: defaultSquad,
      missionType: MissionType.Default,
      allowTacticalPause: 16,
      startPaused: 16,
      startingThreatLevel: 3,
      enemyGrowthPerMission: false,
      missionDepth: 0,
      nodeType: 1.0,
      campaignNodeId: true,
      startingPoints: true
    });
    expect(client.getIsPaused()).toBe(true);
    expect(client.getTimeScale()).toBe(0.1);
  });
});
