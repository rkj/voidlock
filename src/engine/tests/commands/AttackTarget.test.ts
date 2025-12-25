import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  Vector2,
  SquadConfig,
  Archetype,
  ArchetypeLibrary,
} from "../../../shared/types";

describe("Command: ATTACK_TARGET", () => {
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
    // Add one unit
    engine.addUnit({
      id: "u1",
      pos: { x: 5.5, y: 5.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 100, // Fast fire for testing
      attackRange: 5,
      sightRange: 10,
      speed: 2,
      commandQueue: [],
    });
  });

  it("should force unit to attack specific target even if another is closer", () => {
    // Enemy 1: Close (Distance 1)
    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 4.5 },
      hp: 100,
      maxHp: 100,
      type: "Grunt",
      damage: 0,
      fireRate: 1000,
      attackRange: 1,
      speed: 2,
    });
    // Enemy 2: Farther (Distance 2)
    engine.addEnemy({
      id: "e2",
      pos: { x: 5.5, y: 3.5 },
      hp: 100,
      maxHp: 100,
      type: "Grunt",
      damage: 0,
      fireRate: 1000,
      attackRange: 1,
      speed: 2,
    });

    // Default behavior: attack closest (e1)
    engine.update(100); // 1 tick
    let state = engine.getState();
    let e1 = state.enemies.find((e) => e.id === "e1");
    let e2 = state.enemies.find((e) => e.id === "e2");

    // e1 should take damage, e2 full health
    expect(e1?.hp).toBeLessThan(100);
    expect(e2?.hp).toBe(100);

    // Reset health
    const defaultSquad: SquadConfig = [{ archetypeId: "assault", count: 1 }]; // Re-declare for scope or make global if multiple use. For now, re-declare.
    engine = new CoreEngine(map, 123, defaultSquad, false, false); // Re-initialize with squad
    engine.clearUnits();
    engine.addUnit({
      id: "u1",
      pos: { x: 5.5, y: 5.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 100,
      attackRange: 5,
      sightRange: 10,
      speed: 2,
      commandQueue: [],
    });
    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 4.5 },
      hp: 100,
      maxHp: 100,
      type: "Grunt",
      damage: 0,
      fireRate: 1000,
      attackRange: 1,
      speed: 2,
    });
    engine.addEnemy({
      id: "e2",
      pos: { x: 5.5, y: 3.5 },
      hp: 100,
      maxHp: 100,
      type: "Grunt",
      damage: 0,
      fireRate: 1000,
      attackRange: 1,
      speed: 2,
    });

    // Issue ATTACK_TARGET e2
    engine.applyCommand({
      type: CommandType.ATTACK_TARGET,
      unitId: "u1",
      targetId: "e2",
    });

    engine.update(100); // 1 tick
    state = engine.getState();
    e1 = state.enemies.find((e) => e.id === "e1");
    e2 = state.enemies.find((e) => e.id === "e2");

    // e2 should take damage, e1 full health
    expect(e2?.hp).toBeLessThan(100);
    expect(e1?.hp).toBe(100);
  });

  it("should stop attacking forced target if it dies", () => {
    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 4.5 },
      hp: 10,
      maxHp: 10,
      type: "Grunt",
      damage: 0,
      fireRate: 1000,
      attackRange: 1,
      speed: 2,
    });

    engine.applyCommand({
      type: CommandType.ATTACK_TARGET,
      unitId: "u1",
      targetId: "e1",
    });

    // Attack until death
    engine.update(100); // Hit 1 (10 dmg -> 0 hp)

    // Cleanup happens at end of tick. Next tick, e1 is gone.
    engine.update(100);

    const state = engine.getState();
    const unit = state.units.find((u) => u.id === "u1");
    expect(unit?.forcedTargetId).toBeUndefined();
  });
});
