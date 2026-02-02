import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MissionType,
  UnitState,
  SquadConfig,
  Objective,
} from "@src/shared/types";

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

  const getInternalState = (engine: CoreEngine) => (engine as any).state;

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
    const vip = getInternalState(engine).units.find(
      (u: any) => u.archetypeId === "vip",
    );
    expect(vip).toBeDefined();

    // Kill the VIP
    vip.hp = 0;

    engine.update(100);

    expect(engine.getState().status).toBe("Lost");
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

    // Complete the other objective
    getInternalState(engine).objectives.find(
      (o: any) => o.id === "obj-1",
    ).state = "Completed";

    // Kill the VIP
    const internalVip = getInternalState(engine).units.find(
      (u: any) => u.archetypeId === "vip",
    );
    internalVip.hp = 0;

    engine.update(100);

    expect(engine.getState().status).toBe("Lost");
  });

  it("should fail if VIP dies in a Default mission (manually added VIP)", () => {
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

    expect(
      getInternalState(engine2).objectives.some(
        (o: Objective) => o.id === "obj-escort",
      ),
    ).toBe(true);

    // Kill the VIP
    const internalVip = getInternalState(engine2).units.find(
      (u: any) => u.archetypeId === "vip",
    );
    internalVip.hp = 0;

    // Extract the assault
    const assault = getInternalState(engine2).units.find(
      (u: any) => u.archetypeId === "assault",
    );
    assault.state = UnitState.Extracted;

    engine2.update(100);

    expect(engine2.getState().status).toBe("Lost");
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

    // In Default mission, setupMission adds obj-escort if hasVipInSquad is true.
    expect(
      getInternalState(engine).objectives.some(
        (o: Objective) => o.id === "obj-escort",
      ),
    ).toBe(true);

    // Kill the VIP
    const internalVip = getInternalState(engine).units.find(
      (u: any) => u.archetypeId === "vip",
    );
    internalVip.hp = 0;

    // Extract the assault
    const assault = getInternalState(engine).units.find(
      (u: any) => u.archetypeId === "assault",
    );
    assault.state = UnitState.Extracted;

    engine.update(100);

    expect(engine.getState().status).toBe("Lost");
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

    // Kill the VIP
    const internalVip = getInternalState(engine).units.find(
      (u: any) => u.archetypeId === "vip",
    );
    internalVip.hp = 0;

    // Complete all artifacts and extract assault
    getInternalState(engine).objectives.forEach((o: any) => {
      if (o.kind === "Recover") o.state = "Completed";
    });

    const assault = getInternalState(engine).units.find(
      (u: any) => u.archetypeId === "assault",
    );
    assault.state = UnitState.Extracted;

    engine.update(100);

    expect(engine.getState().status).toBe("Lost");
  });
});
