import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MissionType,
  CellType,
  MapDefinition,
  SquadConfig,
  CommandType,
} from "@src/shared/types";

describe("Regression 0nub: Debug Force Win/Lose Buttons", () => {
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
    spawnPoints: [{ id: "spawn-1", pos: { x: 1, y: 1 }, radius: 1 }],
    squadSpawn: { x: 1, y: 1 },
    extraction: { x: 9, y: 9 },
    objectives: [
      { id: "obj-1", kind: "Recover", targetCell: { x: 5, y: 5 } }
    ],
  };

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor, roomId: "room-1" });
    }
  }

  const squadConfig: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }],
    inventory: {},
  };

  it("should force win when DEBUG_FORCE_WIN command is received", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      squadConfig,
      true,
      false,
      MissionType.Default,
    );
    const state = engine.getState();
    expect(state.status).toBe("Playing");
    expect(state.objectives[0].state).toBe("Pending");

    engine.applyCommand({
      type: CommandType.DEBUG_FORCE_WIN,
    });

    const newState = engine.getState();
    expect(newState.status).toBe("Won");
    expect(newState.objectives[0].state).toBe("Completed");
  });

  it("should force lose when DEBUG_FORCE_LOSE command is received", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      squadConfig,
      true,
      false,
      MissionType.Default,
    );
    const state = engine.getState();
    expect(state.status).toBe("Playing");

    engine.applyCommand({
      type: CommandType.DEBUG_FORCE_LOSE,
    });

    const newState = engine.getState();
    expect(newState.status).toBe("Lost");
  });
});
