import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  SquadConfig,
  CommandType,
  UnitState,
  CellType,
  EnemyType,
} from "@src/shared/types";

describe("Turret (Auto Cannon)", () => {
  const mockMap: MapDefinition = {
    width: 5,
    height: 5,
    cells: [
      { x: 0, y: 0, type: CellType.Floor }, { x: 1, y: 0, type: CellType.Floor }, { x: 2, y: 0, type: CellType.Floor }, { x: 3, y: 0, type: CellType.Floor }, { x: 4, y: 0, type: CellType.Floor },
      { x: 0, y: 1, type: CellType.Floor }, { x: 1, y: 1, type: CellType.Floor }, { x: 2, y: 1, type: CellType.Floor }, { x: 3, y: 1, type: CellType.Floor }, { x: 4, y: 1, type: CellType.Floor },
      { x: 0, y: 2, type: CellType.Floor }, { x: 1, y: 2, type: CellType.Floor }, { x: 2, y: 2, type: CellType.Floor }, { x: 3, y: 2, type: CellType.Floor }, { x: 4, y: 2, type: CellType.Floor },
      { x: 0, y: 3, type: CellType.Floor }, { x: 1, y: 3, type: CellType.Floor }, { x: 2, y: 3, type: CellType.Floor }, { x: 3, y: 3, type: CellType.Floor }, { x: 4, y: 3, type: CellType.Floor },
      { x: 0, y: 4, type: CellType.Floor }, { x: 1, y: 4, type: CellType.Floor }, { x: 2, y: 4, type: CellType.Floor }, { x: 3, y: 4, type: CellType.Floor }, { x: 4, y: 4, type: CellType.Floor },
    ],
    spawnPoints: [{ id: "spawn-1", pos: { x: 4, y: 4 }, radius: 1 }],
    squadSpawn: { x: 0, y: 0 },
  };

  const squadConfig: SquadConfig = {
    soldiers: [
      { id: "s1", archetypeId: "scout", hp: 100, maxHp: 100, soldierAim: 80 },
    ],
    inventory: { sentry_mk1: 1 },
  };

  it("should be deployable and automatically shoot enemies", () => {
    const engine = new CoreEngine(mockMap, 123, squadConfig, false, false);
    const state = engine.getState();
    const unit = state.units[0];

    expect(state.squadInventory["sentry_mk1"]).toBe(1);

    // Command to use sentry at (2, 2)
    engine.applyCommand({
      type: CommandType.USE_ITEM,
      unitIds: [unit.id],
      itemId: "sentry_mk1",
      target: { x: 2, y: 2 },
    });

    // Run engine until unit moves to (2, 2) and finishes channeling
    let deployed = false;
    for (let i = 0; i < 200; i++) {
      engine.update(100);
      if (engine.getState().turrets.length > 0) {
          deployed = true;
          break;
      }
    }
    expect(deployed).toBe(true);

    const newState = engine.getState();
    expect(newState.squadInventory["sentry_mk1"]).toBe(0);
    expect(newState.turrets.length).toBe(1);
    expect(newState.turrets[0].pos).toEqual({ x: 2, y: 2 });

    // --- Shooting Test ---

    // Disable unit shooting to ensure turret is the one shooting
    engine.applyCommand({
        type: CommandType.SET_ENGAGEMENT,
        unitIds: [unit.id],
        mode: "IGNORE"
    });

    // Add an enemy at (3, 3)
    engine.addEnemy({
      id: "e1",
      pos: { x: 3.5, y: 3.5 },
      hp: 100,
      maxHp: 100,
      type: EnemyType.XenoMite,
      damage: 10,
      fireRate: 1000,
      accuracy: 50,
      attackRange: 1,
      speed: 10,
      difficulty: 1,
    });

    // Run engine to trigger shooting
    // Sentry Mk1 has 500ms fire rate. 2 seconds should be enough for multiple shots.
    engine.update(2000);

    const finalState = engine.getState();
    expect(finalState.enemies.length).toBe(1);
    expect(finalState.enemies[0].hp).toBeLessThan(100);
    expect(finalState.attackEvents?.length).toBeGreaterThan(0);
    const turretEvent = finalState.attackEvents?.find(e => e.attackerId.startsWith("turret-"));
    expect(turretEvent).toBeDefined();
  });
});