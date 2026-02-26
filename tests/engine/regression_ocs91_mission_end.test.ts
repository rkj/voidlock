import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MissionType,
  UnitState,
  CellType,
  MapDefinition,
  SquadConfig,
  GameState,
  Objective,
} from "@src/shared/types";

describe("Mission End Regression (voidlock-ocs91)", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
    spawnPoints: [{ id: "spawn-1", pos: { x: 1, y: 1 }, radius: 1 }],
    squadSpawn: { x: 1, y: 1 },
    extraction: { x: 9, y: 9 },
    objectives: [],
  };

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor, roomId: "room-1" });
    }
  }

  const squadConfig: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }, { archetypeId: "assault" }],
    inventory: {},
  };

  const getInternalState = (engine: CoreEngine): GameState =>
    (engine as any).state;

  it("should NOT end RecoverIntel mission until all soldiers are dead or extracted", () => {
    const intelMap: MapDefinition = {
      ...mockMap,
      objectives: [
        { id: "intel-0", kind: "Recover", targetCell: { x: 2, y: 2 } },
      ],
    };
    const engine = new CoreEngine(
      intelMap,
      1,
      squadConfig,
      true,
      false,
      MissionType.RecoverIntel,
    );

    // Complete objectives
    getInternalState(engine).objectives.forEach(
      (o: Objective) => (o.state = "Completed"),
    );

    engine.update(100);
    // FAIL EXPECTATION: Currently it wins immediately
    expect(engine.getState().status).toBe("Playing");

    // Extract one soldier
    getInternalState(engine).units[0].state = UnitState.Extracted;
    engine.update(100);
    expect(engine.getState().status).toBe("Playing");

    // Extract last soldier
    getInternalState(engine).units[1].state = UnitState.Extracted;
    engine.update(100);
    expect(engine.getState().status).toBe("Won");
  });

  it("should NOT end DestroyHive mission until all soldiers are dead or extracted", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      squadConfig,
      true,
      false,
      MissionType.DestroyHive,
    );

    const hiveObj = getInternalState(engine).objectives.find(
      (o: Objective) => o.kind === "Kill",
    );
    expect(hiveObj).toBeDefined();
    if (hiveObj) hiveObj.state = "Completed";

    engine.update(100);
    // FAIL EXPECTATION: Currently it wins immediately
    expect(engine.getState().status).toBe("Playing");

    // Wipe squad
    getInternalState(engine).units.forEach((u: any) => (u.hp = 0));
    engine.update(100);
    expect(engine.getState().status).toBe("Won");
  });

  it("should NOT end EscortVIP mission when VIP extracts if other soldiers are still active", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      squadConfig,
      true,
      false,
      MissionType.EscortVIP,
    );

    const getUnitById = (id: string) => getInternalState(engine).units.find(u => u.id === id);

    const vip = getInternalState(engine).units.find(u => u.archetypeId === "vip")!;
    const s1 = getInternalState(engine).units.find(u => u.archetypeId === "assault" && u.id.endsWith("-1"))!;
    const s2 = getInternalState(engine).units.find(u => u.archetypeId === "assault" && u.id.endsWith("-2"))!;

    expect(vip).toBeDefined();
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();

    // 1. VIP extracts
    vip.state = UnitState.Extracted;
    engine.update(100);
    expect(engine.getState().status).toBe("Playing");

    // 2. S1 extracts
    const currentS1 = getUnitById(s1.id)!;
    currentS1.state = UnitState.Extracted;
    engine.update(100);
    expect(engine.getState().status).toBe("Playing");

    // 3. S2 extracts
    const currentS2 = getUnitById(s2.id)!;
    currentS2.state = UnitState.Extracted;
    engine.update(100);
    expect(engine.getState().status).toBe("Won");
  });
});
