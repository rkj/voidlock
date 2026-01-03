import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  SquadConfig,
  ArchetypeLibrary,
} from "@src/shared/types";

describe("Squad Configuration in CoreEngine", () => {
  const mockMap: MapDefinition = {
    width: 5,
    height: 5,
    cells: Array.from({ length: 25 }, (_, i) => ({
      x: i % 5,
      y: Math.floor(i / 5),
      type: CellType.Floor,
    })),
    spawnPoints: [{ id: "sp1", pos: { x: 0, y: 0 }, radius: 1 }],
    extraction: { x: 4, y: 4 },
  };

  it("should initialize units based on SquadConfig", () => {
    const squadConfig: SquadConfig = {
      soldiers: [
        { archetypeId: "assault" },
        { archetypeId: "assault" },
        { archetypeId: "medic" },
      ],
      inventory: {},
    };

    const engine = new CoreEngine(mockMap, 123, squadConfig, false, false);
    const state = engine.getState();

    // Total units should be 3
    expect(state.units.length).toBe(3);

    // Verify types
    const assaultUnits = state.units.filter((u) => u.archetypeId === "assault");
    const medicUnits = state.units.filter((u) => u.archetypeId === "medic");

    expect(assaultUnits.length).toBe(2);
    expect(medicUnits.length).toBe(1);

    // Verify IDs are unique
    const ids = new Set(state.units.map((u) => u.id));
    expect(ids.size).toBe(3);
  });

  it("should handle empty squad config", () => {
    const squadConfig: SquadConfig = { soldiers: [], inventory: {} };
    const engine = new CoreEngine(mockMap, 123, squadConfig, false, false);
    const state = engine.getState();
    expect(state.units.length).toBe(0);
  });

  it("should handle large squad config", () => {
    const squadConfig: SquadConfig = {
      soldiers: Array(10).fill({ archetypeId: "assault" }),
      inventory: {},
    };
    const engine = new CoreEngine(mockMap, 123, squadConfig, false, false);
    const state = engine.getState();
    expect(state.units.length).toBe(10);
  });

  it("should ignore invalid archetype IDs", () => {
    const squadConfig: SquadConfig = {
      soldiers: [{ archetypeId: "invalid-id" }, { archetypeId: "assault" }],
      inventory: {},
    };
    const engine = new CoreEngine(mockMap, 123, squadConfig, false, false);
    const state = engine.getState();
    expect(state.units.length).toBe(1); // Only the assault unit
  });
});
