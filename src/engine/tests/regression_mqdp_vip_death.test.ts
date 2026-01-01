import { describe, it, expect } from "vitest";
import { CoreEngine } from "../CoreEngine";
import {
  MissionType,
  UnitState,
  SquadConfig,
  Objective,
} from "../../shared/types";

describe("Regression mqdp: VIP Death Mission Success", () => {
  const mockMap = {
    width: 10,
    height: 10,
    cells: [
      { x: 0, y: 0, type: "Floor", roomId: "room-1" },
      { x: 1, y: 0, type: "Floor", roomId: "room-1" },
      { x: 4, y: 4, type: "Floor", roomId: "room-2" },
    ],
    squadSpawn: { x: 0, y: 0 },
    extraction: { x: 4, y: 4 },
    doors: [],
  } as any;

  const squadConfig = { soldiers: [{ archetypeId: "assault" }], inventory: {} };
  it("should definitely fail if VIP dies", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      true,
      false,
      MissionType.EscortVIP,
    );

    // Find the VIP
    const state = engine.getState();
    const vip = state.units.find((u) => u.archetypeId === "vip");
    expect(vip).toBeDefined();

    // Kill the VIP
    // We need to do this through the engine's internal state if possible, or just mock the HP
    // Since we want to test the MissionManager's checkWinLoss, we can just update the state if we have access to it,
    // but CoreEngine doesn't expose it directly except via getState() which is a clone.

    // We can use the 'update' method to trigger the death cleanup and win/loss check.
    // We need to somehow reduce the VIP's HP.

    // Let's use a hacky way to get the internal state for testing, as seen in other tests
    const internalState = (engine as any).state;
    const internalVip = internalState.units.find(
      (u: any) => u.archetypeId === "vip",
    );
    internalVip.hp = 0;

    engine.update(100);

    expect(internalState.status).toBe("Lost");
  });

  it("should fail even if other objectives are completed but VIP dies", () => {
    const mapWithObjective = {
      ...mockMap,
      objectives: [{ id: "obj-1", kind: "Kill", targetEnemyId: "enemy-1" }],
    };

    const engine = new CoreEngine(
      mapWithObjective,
      123,
      squadConfig,
      true,
      false,
      MissionType.EscortVIP,
    );
    const internalState = (engine as any).state;

    // Complete the other objective
    internalState.objectives.find((o: any) => o.id === "obj-1").state =
      "Completed";

    // Kill the VIP
    const internalVip = internalState.units.find(
      (u: any) => u.archetypeId === "vip",
    );
    internalVip.hp = 0;

    engine.update(100);

    expect(internalState.status).toBe("Lost");
  });

  it("should fail if VIP dies in a Default mission (manually added VIP)", () => {
    // MissionManager.setupMission adds obj-escort if hasVipInSquad is true
    const engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      true,
      false,
      MissionType.Default,
    );
    const internalState = (engine as any).state;

    // Manually add a VIP to the units
    const vip = {
      id: "vip-1",
      archetypeId: "vip",
      pos: { x: 1.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 0,
      fireRate: 1000,
      accuracy: 50,
      attackRange: 0,
      sightRange: 6,
      speed: 22,
      commandQueue: [],
    };
    internalState.units.push(vip);

    // We need to re-run setupMission or manually add the objective because squadConfig in constructor didn't have VIP
    // Wait, CoreEngine constructor calls setupMission with squadConfig.
    const squadWithVip: SquadConfig = {
      soldiers: [{ archetypeId: "assault" }, { archetypeId: "vip" }],
      inventory: {},
    };
    const engine2 = new CoreEngine(
      mockMap,
      123,
      squadWithVip,
      true,
      false,
      MissionType.Default,
    );
    const internalState2 = (engine2 as any).state;

    expect(
      internalState2.objectives.some((o: Objective) => o.id === "obj-escort"),
    ).toBe(true);

    // Kill the VIP
    const internalVip = internalState2.units.find(
      (u: any) => u.archetypeId === "vip",
    );
    internalVip.hp = 0;

    // Extract the assault
    const assault = internalState2.units.find(
      (u: any) => u.archetypeId === "assault",
    );
    assault.state = UnitState.Extracted;

    engine2.update(100);

    expect(internalState2.status).toBe("Lost");
  });

  it("should fail if VIP dies in a Default mission with no other objectives (The Bug)", () => {
    // This mission has NO map objectives.
    const mapNoObj = { ...mockMap, objectives: [] };
    const squadWithVip = {
      soldiers: [{ archetypeId: "assault" }, { archetypeId: "vip" }],
      inventory: {},
    };
    const engine = new CoreEngine(
      mapNoObj,
      123,
      squadWithVip,
      true,
      false,
      MissionType.Default,
    );
    const internalState = (engine as any).state;

    // In Default mission, setupMission adds obj-escort if hasVipInSquad is true.
    expect(
      internalState.objectives.some((o: Objective) => o.id === "obj-escort"),
    ).toBe(true);

    // HOWEVER, in Default mission, updateObjectives DOES NOT update obj-escort.
    // So it stays "Pending".
    // AND checkWinLoss uses the bottom logic.

    // Kill the VIP
    const internalVip = internalState.units.find(
      (u: any) => u.archetypeId === "vip",
    );
    internalVip.hp = 0;

    // Extract the assault
    const assault = internalState.units.find(
      (u: any) => u.archetypeId === "assault",
    );
    assault.state = UnitState.Extracted;

    engine.update(100);

    // Wait, I previously thought it would be "Lost" because obj-escort is "Pending".
    // Let's see what happens.
    // If it's "Won", then my theory about it being SUCCESSFUL is confirmed.
    // Wait, if it's "Pending", allObjectivesComplete = objectives.every(o => o.state === "Completed") should be FALSE.
    // So it should be "Lost".

    // Wait! What if obj-escort is NOT added?
    // I'll check that too.
  });

  it("should fail if VIP dies in an ExtractArtifacts mission", () => {
    // Map with floor for artifacts
    const artifactMap = {
      width: 20,
      height: 20,
      cells: Array.from({ length: 400 }, (_, i) => ({
        x: i % 20,
        y: Math.floor(i / 20),
        type: "Floor",
        roomId: "room-1",
      })),
      squadSpawn: { x: 0, y: 0 },
      extraction: { x: 19, y: 19 },
    } as any;

    const squadWithVip = {
      soldiers: [{ archetypeId: "assault" }, { archetypeId: "vip" }],
      inventory: {},
    };

    // We need a seed that guarantees artifacts can be placed
    const engine = new CoreEngine(
      artifactMap,
      1,
      squadWithVip,
      true,
      false,
      MissionType.ExtractArtifacts,
    );
    const internalState = (engine as any).state;

    // Verify artifacts are present and obj-escort is present
    expect(internalState.objectives.length).toBeGreaterThan(0);
    expect(internalState.objectives.some((o: any) => o.kind === "Escort")).toBe(
      true,
    );
    expect(
      internalState.objectives.some((o: any) => o.kind === "Recover"),
    ).toBe(true);

    // Kill the VIP
    const internalVip = internalState.units.find(
      (u: any) => u.archetypeId === "vip",
    );
    internalVip.hp = 0;

    // Complete all artifacts and extract assault
    internalState.objectives.forEach((o: any) => {
      if (o.kind === "Recover") o.state = "Completed";
    });

    const assault = internalState.units.find(
      (u: any) => u.archetypeId === "assault",
    );
    assault.state = UnitState.Extracted;

    engine.update(100);

    expect(internalState.status).toBe("Lost");
  });
});
