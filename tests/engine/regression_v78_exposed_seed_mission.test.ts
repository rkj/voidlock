import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  SquadConfig,
  MissionType,
} from "@src/shared/types";

describe("CoreEngine: Exposed Seed & Mission Type", () => {
  const mockMap: MapDefinition = {
    width: 2,
    height: 2,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 0, y: 1, type: CellType.Floor },
      { x: 1, y: 1, type: CellType.Floor },
    ],
  };

  it("should expose seed and missionType in the GameState", () => {
    const seed = 98765;
    const missionType = MissionType.DestroyHive;
    const squadConfig: SquadConfig = {
      soldiers: [],
      inventory: {},
    };

    const engine = new CoreEngine(
      mockMap,
      seed,
      squadConfig,
      false,
      false,
      missionType
    );

    const state = engine.getState();
    expect(state.seed).toBe(seed);
    expect(state.missionType).toBe(missionType);
  });

  it("should default missionType to Default if not provided", () => {
    const seed = 12345;
    const squadConfig: SquadConfig = {
      soldiers: [],
      inventory: {},
    };

    const engine = new CoreEngine(
      mockMap,
      seed,
      squadConfig,
      false,
      false
    );

    const state = engine.getState();
    expect(state.seed).toBe(seed);
    expect(state.missionType).toBe(MissionType.Default);
  });
});
