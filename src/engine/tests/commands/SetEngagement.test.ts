import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  SquadConfig,
  Archetype,
  ArchetypeLibrary,
} from "../../../shared/types";
import { GameGrid } from "../../GameGrid";

describe("Command: SET_ENGAGEMENT", () => {
  let engine: CoreEngine;
  const map: MapDefinition = {
    width: 10,
    height: 10,
    cells: Array(100)
      .fill(null)
      .map((_, i) => ({
        x: i % 10,
        y: Math.floor(i / 10),
        type: CellType.Floor,
      })),
    spawnPoints: [],
    extraction: { x: 9, y: 9 },
    objectives: [],
  };

  beforeEach(() => {
    const defaultSquad: SquadConfig = [{ archetypeId: "assault", count: 1 }]; // Default unit for tests
    engine = new CoreEngine(map, 123, defaultSquad, false, false);
    engine.clearUnits();
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 100,
      accuracy: 0,
      attackRange: 5,
      sightRange: 10,
      speed: 2,
      commandQueue: [],
      archetypeId: "assault",
    });
    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      type: "Grunt",
      damage: 0,
      fireRate: 1000,
      accuracy: 0,
      attackRange: 1,
      speed: 2,
    });
  });

  it("should stop and attack by default (ENGAGE)", () => {
    // Move past enemy
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 9, y: 0 },
    });

    // Run updates until in range
    // Distance starts at 5. Range is 5. Should attack immediately if in range?
    // 0.5 to 5.5 is dist 5.0. Range 5 + 0.5 = 5.5.
    // So u1 starts in range of e1.
    engine.update(100);

    const state = engine.getState();
    const u1 = state.units.find((u) => u.id === "u1");
    const e1 = state.enemies.find((e) => e.id === "e1");

    expect(u1?.state).toBe(UnitState.Attacking);
    expect(e1?.hp).toBeLessThan(100);
    // Position should effectively be start position (or very close)
    expect(u1?.pos.x).toBeCloseTo(0.5, 1);
  });

  it("should ignore enemy and keep moving if policy is IGNORE", () => {
    // Set IGNORE
    engine.applyCommand({
      type: CommandType.SET_ENGAGEMENT,
      unitIds: ["u1"],
      mode: "IGNORE",
    });

    // Move past enemy
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 9, y: 0 },
    });

    engine.update(100);

    const state = engine.getState();
    const u1 = state.units.find((u) => u.id === "u1");
    const e1 = state.enemies.find((e) => e.id === "e1");

    expect(u1?.state).toBe(UnitState.Moving);
    expect(e1?.hp).toBe(100); // Should not have fired
    // Should have moved (speed 2 tiles/s * 0.1s = 0.2 tiles)
    expect(u1?.pos.x).toBeGreaterThan(0.5);
  });
});
