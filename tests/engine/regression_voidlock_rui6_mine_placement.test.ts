import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { SPEED_NORMALIZATION_CONST } from "@src/engine/Constants";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  ItemLibrary,
} from "@src/shared/types";

describe("Regression voidlock-rui6: Landmine Placement & Scaling", () => {
  const mockMap: MapDefinition = {
    width: 5,
    height: 5,
    cells: [],
    spawnPoints: [],
    extraction: { x: 4, y: 4 },
  };

  // Fill cells
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor });
    }
  }

  it("should scale landmine placement duration based on unit speed", () => {
    const baseChannelTime = 3000;

    // Test with standard speed (30)
    const engine30 = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ archetypeId: "assault" }], inventory: { mine: 1 } },
      false,
      false,
    );
    const unit30 = (engine30 as any).state.units[0];
    unit30.stats.speed = 30;
    unit30.pos = { x: 2.5, y: 2.5 };

    engine30.applyCommand({
      type: CommandType.USE_ITEM,
      unitIds: [unit30.id],
      itemId: "mine",
      target: { x: 2, y: 2 },
    });

    // It should be channeling now
    engine30.update(100);
    const state30 = engine30.getState().units[0];
    expect(state30.state).toBe(UnitState.Channeling);
    // 3000 * (30/30) = 3000
    expect(state30.channeling?.totalDuration).toBe(baseChannelTime);

    // Test with slow speed (15)
    const engine15 = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ archetypeId: "assault" }], inventory: { mine: 1 } },
      false,
      false,
    );
    const unit15 = (engine15 as any).state.units[0];
    unit15.stats.speed = 15;
    unit15.pos = { x: 2.5, y: 2.5 };

    engine15.applyCommand({
      type: CommandType.USE_ITEM,
      unitIds: [unit15.id],
      itemId: "mine",
      target: { x: 2, y: 2 },
    });

    engine15.update(100);
    const state15 = engine15.getState().units[0];
    expect(state15.state).toBe(UnitState.Channeling);
    // 3000 * (30/15) = 6000
    expect(state15.channeling?.totalDuration).toBe(baseChannelTime * 2);

    // Test with fast speed (60)
    const engine60 = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ archetypeId: "assault" }], inventory: { mine: 1 } },
      false,
      false,
    );
    const unit60 = (engine60 as any).state.units[0];
    unit60.stats.speed = 60;
    unit60.pos = { x: 2.5, y: 2.5 };

    engine60.applyCommand({
      type: CommandType.USE_ITEM,
      unitIds: [unit60.id],
      itemId: "mine",
      target: { x: 2, y: 2 },
    });

    engine60.update(100);
    const state60 = engine60.getState().units[0];
    expect(state60.state).toBe(UnitState.Channeling);
    // 3000 * (30/60) = 1500
    expect(state60.channeling?.totalDuration).toBe(baseChannelTime / 2);
  });

  it("should follow Move -> Channel -> Place flow for mines", () => {
    const engine = new CoreEngine(
      mockMap,
      123,
      { soldiers: [{ archetypeId: "assault" }], inventory: { mine: 1 } },
      false,
      false,
    );
    const unit = (engine as any).state.units[0];
    unit.stats.speed = 30;
    unit.pos = { x: 0.5, y: 0.5 };

    // Target is (2,2)
    engine.applyCommand({
      type: CommandType.USE_ITEM,
      unitIds: [unit.id],
      itemId: "mine",
      target: { x: 2, y: 2 },
    });

    // Should be moving first
    engine.update(100);
    expect(engine.getState().units[0].state).toBe(UnitState.Moving);

    // Wait until it reaches (2,2)
    // Distance (0,0) to (2,2) is sqrt(8) ~ 2.82 tiles
    // Speed 30 means 3 tiles/s (WAIT, speed 30 is 3 tiles/s? Let's check Constants/Movement)
    // Actually MovementManager uses speed / normalization_const? No.
    // CoreEngine updates unit.pos based on speed and dt.
    // Normalized speed is unit.stats.speed / 10? No.

    // Let's check MovementManager.ts
    // Wait, let's just update enough time.
    // We need multiple ticks because the path might have multiple steps
    for (let i = 0; i < 60; i++) {
      engine.update(100);
    }

    // Now it should be channeling
    expect(engine.getState().units[0].state).toBe(UnitState.Channeling);
    expect(Math.floor(engine.getState().units[0].pos.x)).toBe(2);
    expect(Math.floor(engine.getState().units[0].pos.y)).toBe(2);

    // Wait for channel completion (3s base)
    engine.update(3100);

    // Should be Idle now
    expect(engine.getState().units[0].state).toBe(UnitState.Idle);

    // Mine should be spawned
    const state = engine.getState();
    expect(state.mines.length).toBe(1);
    expect(state.mines[0].pos.x).toBe(2);
    expect(state.mines[0].pos.y).toBe(2);

    // Test explosion
    // Add an enemy at (2,2)
    engine.addEnemy({
      id: "enemy-1",
      pos: { x: 2.5, y: 2.5 },
      hp: 100,
      maxHp: 100,
      type: "Xeno-Mite" as any,
      damage: 10,
      fireRate: 500,
      accuracy: 50,
      attackRange: 1,
      speed: 30,
      difficulty: 1,
    } as any);

    // Update to trigger explosion
    engine.update(100);

    const stateAfterExplosion = engine.getState();
    expect(stateAfterExplosion.mines.length).toBe(0);
    // Enemy should be dead (100 HP - 100 DMG)
    expect(stateAfterExplosion.enemies.length).toBe(0);
  });
});
