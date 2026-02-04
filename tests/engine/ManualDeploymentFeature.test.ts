import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  SquadConfig,
} from "@src/shared/types";

describe("Manual Deployment Feature", () => {
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
      { id: "s1", archetypeId: "assault" },
      { id: "s2", archetypeId: "medic" },
    ],
    inventory: {},
  };

  it("should respect skipDeployment = false and stay in Deployment status", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      squadConfig,
      false,
      false,
      undefined,
      undefined,
      0,
      1.0,
      false,
      undefined,
      [],
      true,
      0,
      3,
      1,
      0,
      "Combat",
      undefined,
      undefined,
      false, // skipDeployment = false
    );
    expect(engine.getState().status).toBe("Deployment");
  });

  it("should not randomly assign units if we want manual deployment?", () => {
    // Actually, currently it DOES randomly assign them as a starting point.
    // Let's see if we want to change that.
    const engine1 = new CoreEngine(
      mockMap,
      1, // seed 1
      squadConfig,
      false,
      false,
      undefined,
      undefined,
      0,
      1.0,
      false,
      undefined,
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
    const engine2 = new CoreEngine(
      mockMap,
      2, // seed 2
      squadConfig,
      false,
      false,
      undefined,
      undefined,
      0,
      1.0,
      false,
      undefined,
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

    const pos1 = engine1.getState().units.map(u => ({ x: Math.floor(u.pos.x), y: Math.floor(u.pos.y) }));
    const pos2 = engine2.getState().units.map(u => ({ x: Math.floor(u.pos.x), y: Math.floor(u.pos.y) }));
    
    // They should be deterministic now because skipDeployment=false disables shuffle.
    expect(pos1).toEqual(pos2);
    // Specifically, they should match the order of squadSpawns: (1,1) then (2,1)
    expect(pos1[0]).toEqual({ x: 1, y: 1 });
    expect(pos1[1]).toEqual({ x: 2, y: 1 });
  });
});
