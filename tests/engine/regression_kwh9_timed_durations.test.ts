import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
} from "@src/shared/types";
import { SPEED_NORMALIZATION_CONST } from "@src/engine/Constants";

describe("Regression (voidlock-kwh9): Standardized Timed Durations", () => {
  const mockMap: MapDefinition = {
    width: 5,
    height: 5,
    cells: [],
    squadSpawn: { x: 2, y: 2 },
    extraction: { x: 4, y: 4 },
  };
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor });
    }
  }

  it("Medkit duration should scale with unit speed (Base 3000ms)", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      {
        soldiers: [
          { archetypeId: "assault", id: "unit-slow" }, // Speed 20
          { archetypeId: "scout", id: "unit-fast" }, // Speed 30
        ],
        inventory: { medkit: 2 },
      },
      false,
      false,
    );

    const state = engine.getState();
    const unitSlow = state.units.find((u) => u.id === "unit-slow")!;
    const unitFast = state.units.find((u) => u.id === "unit-fast")!;

    expect(unitSlow.stats.speed).toBe(20);
    expect(unitFast.stats.speed).toBe(30);

    // Unit slow uses medkit
    engine.applyCommand({
      type: CommandType.USE_ITEM,
      unitIds: ["unit-slow"],
      itemId: "medkit",
      targetUnitId: "unit-slow",
    });

    engine.update(100);
    const slowState = engine
      .getState()
      .units.find((u) => u.id === "unit-slow")!;
    expect(slowState.state).toBe(UnitState.Channeling);
    // Base 3000 * (30/20) = 4500
    expect(slowState.channeling?.totalDuration).toBe(4500);

    // Unit fast uses medkit
    engine.applyCommand({
      type: CommandType.USE_ITEM,
      unitIds: ["unit-fast"],
      itemId: "medkit",
      targetUnitId: "unit-fast",
    });

    engine.update(100);
    const fastState = engine
      .getState()
      .units.find((u) => u.id === "unit-fast")!;
    expect(fastState.state).toBe(UnitState.Channeling);
    // Base 3000 * (30/30) = 3000
    expect(fastState.channeling?.totalDuration).toBe(3000);
  });

  it("Pickup duration should scale with unit speed (Base 3000ms)", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      {
        soldiers: [
          { archetypeId: "assault", id: "unit-slow" }, // Speed 20
        ],
        inventory: {},
      },
      false,
      false,
    );

    const unit = (engine as any).state.units[0];
    unit.pos = { x: 2.5, y: 2.5 }; // Right on top of loot

    (engine as any).lootManager.spawnLoot((engine as any).state, "medkit", {
      x: 2.5,
      y: 2.5,
    });
    const loot = (engine as any).state.loot[0];

    engine.applyCommand({
      type: CommandType.PICKUP,
      unitIds: ["unit-slow"],
      lootId: loot.id,
    });

    engine.update(100);
    const updatedUnit = engine.getState().units[0];
    expect(updatedUnit.state).toBe(UnitState.Channeling);
    expect(updatedUnit.channeling?.action).toBe("Pickup");
    // Base 3000 * (30/20) = 4500
    expect(updatedUnit.channeling?.totalDuration).toBe(4500);
  });

  it("Extraction duration should scale with unit speed (Base 5000ms)", () => {
    const engine = new CoreEngine(
      mockMap,
      1,
      {
        soldiers: [
          { archetypeId: "assault", id: "unit-slow" }, // Speed 20
        ],
        inventory: {},
      },
      false,
      false,
    );

    const unit = (engine as any).state.units[0];
    unit.pos = { x: 4.5, y: 4.5 }; // Right on extraction

    // Trigger extraction (InteractionBehavior)
    engine.update(100);
    const updatedUnit = engine.getState().units[0];
    expect(updatedUnit.state).toBe(UnitState.Channeling);
    expect(updatedUnit.channeling?.action).toBe("Extract");
    // Base 5000 * (30/20) = 7500
    expect(updatedUnit.channeling?.totalDuration).toBe(7500);
  });
});
