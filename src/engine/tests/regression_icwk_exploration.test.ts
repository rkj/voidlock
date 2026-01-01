import { describe, it, expect } from "vitest";
import { CoreEngine } from "../CoreEngine";
import { MapGenerator } from "../MapGenerator";
import {
  UnitState,
  SquadConfig,
  MapGeneratorType,
  Vector2,
} from "../../shared/types";

describe("Exploration Efficiency Regression (ICWK)", () => {
  const seed = 123;
  const squad: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }],
    inventory: {},
  };

  it("should explore the map efficiently (closest first)", () => {
    const asciiMap = `
+-+-+-+-+
|P      |
+       +
|       |
+       +
|       |
+       +
|      E|
+-+-+-+-+
`.trim();
    const map = MapGenerator.fromAscii(asciiMap);

    map.objectives = [
      {
        id: "obj_explore",
        kind: "Recover",
        targetCell: { x: 99, y: 99 },
      },
    ];

    const engine = new CoreEngine(map, seed, squad, true, false);
    engine.clearUnits();
    engine.addUnit({
      id: "u1",
      archetypeId: "assault",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 100,
        accuracy: 1000,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 1,
        sightRange: 0.1,
        speed: 20,
      },
      commandQueue: [],
    });

    const totalFloorCount = map.cells.filter((c) => c.type === "Floor").length;
    const maxTicks = 1000;
    const dt = 100;

    for (let t = 0; t < maxTicks; t++) {
      engine.update(dt);
      const state = engine.getState();
      const unit = state.units[0];
      if (state.discoveredCells.length >= totalFloorCount) {
        break;
      }
    }

    const discoveredCount = engine.getState().discoveredCells.length;
    expect(discoveredCount).toBe(totalFloorCount);
  });
});
