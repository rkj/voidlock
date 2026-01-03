import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  SquadConfig,
  MissionType,
} from "@src/shared/types";

describe("Regression Task 0adr: Default EXPLORE command", () => {
  const mockMap: MapDefinition = {
    width: 3,
    height: 3,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 2, y: 0, type: CellType.Floor },
      { x: 0, y: 1, type: CellType.Floor },
      { x: 1, y: 1, type: CellType.Floor },
      { x: 2, y: 1, type: CellType.Floor },
      { x: 0, y: 2, type: CellType.Floor },
      { x: 1, y: 2, type: CellType.Floor },
      { x: 2, y: 2, type: CellType.Floor },
    ],
    squadSpawn: { x: 1, y: 1 },
  };

  it("should set aiEnabled to true for all units at mission start", () => {
    const squadConfig: SquadConfig = {
      soldiers: [{ archetypeId: "assault" }, { archetypeId: "medic" }],
      inventory: {},
    };

    // Initialize engine with agent control ENABLED
    const engine = new CoreEngine(mockMap, 123, squadConfig, true, false);
    const state = engine.getState();

    expect(state.units.length).toBe(2);
    state.units.forEach((unit) => {
      expect(unit.aiEnabled).toBe(true);
    });
  });

  it("should NOT set aiEnabled to true for VIP units at mission start", () => {
    const squadConfig: SquadConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };

    // Use a mission type that spawns a VIP (EscortVIP)
    const engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      true,
      false,
      MissionType.EscortVIP,
    );
    const state = engine.getState();

    const vips = state.units.filter((u) => u.archetypeId === "vip");
    expect(vips.length).toBeGreaterThan(0);
    vips.forEach((vip) => {
      expect(vip.aiEnabled).toBe(false);
    });

    const soldiers = state.units.filter((u) => u.archetypeId !== "vip");
    soldiers.forEach((soldier) => {
      expect(soldier.aiEnabled).toBe(true);
    });
  });
});
