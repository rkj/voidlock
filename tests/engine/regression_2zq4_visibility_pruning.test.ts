import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  EnemyType,
  AIProfile,
} from "@src/shared/types";

describe("Regression: Unit visibility and state pruning", () => {
  let map: MapDefinition;

  beforeEach(() => {
    map = {
      width: 5,
      height: 5,
      cells: [],
      spawnPoints: [],
      extraction: undefined,
      objectives: [],
    };
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        map.cells.push({ x, y, type: CellType.Floor });
      }
    }
  });

  it("should prune enemies out of LOS when debug mode is OFF", () => {
    const engine = new CoreEngine(
      map,
      123,
      { soldiers: [], inventory: {} },
      true,
      false, // debugOverlayEnabled = false
    );
    engine.clearUnits();

    // Soldier at (0,0)
    engine.addUnit({
      id: "s1",
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
        attackRange: 10,
        speed: 20,
      },
      commandQueue: [],
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      aiProfile: AIProfile.RUSH,
      engagementPolicy: "ENGAGE",
      aiEnabled: true,
    });

    // Enemy at (4,4) - presumably out of some LOS or we can add a wall
    // Infinite LOS is default, let's add a full wall at x=2
    map.walls = [
        { p1: { x: 2, y: 0 }, p2: { x: 2, y: 1 } },
        { p1: { x: 2, y: 1 }, p2: { x: 2, y: 2 } },
        { p1: { x: 2, y: 2 }, p2: { x: 2, y: 3 } },
        { p1: { x: 2, y: 3 }, p2: { x: 2, y: 4 } },
        { p1: { x: 2, y: 4 }, p2: { x: 2, y: 5 } },
    ];
    
    // Re-init engine with walls
    const engineWithWalls = new CoreEngine(
        map,
        123,
        { soldiers: [], inventory: {} },
        true,
        false,
      );
    engineWithWalls.clearUnits();
    engineWithWalls.addUnit({
        id: "s1",
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
          attackRange: 10,
          speed: 20,
        },
        commandQueue: [],
        archetypeId: "assault",
        kills: 0,
        damageDealt: 0,
        objectivesCompleted: 0,
        aiProfile: AIProfile.RUSH,
        engagementPolicy: "ENGAGE",
        aiEnabled: true,
      });

    engineWithWalls.addEnemy({
      id: "e1",
      pos: { x: 4.5, y: 4.5 },
      hp: 100,
      maxHp: 100,
      type: EnemyType.SwarmMelee,
      damage: 10,
      fireRate: 100,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
      difficulty: 1,
    });

    engineWithWalls.update(100);
    const state = engineWithWalls.getState(true);

    // Verify LOS is actually blocked
    const ex = Math.floor(4.5);
    const ey = Math.floor(4.5);
    const idx = ey * map.width + ex;
    const isVisible = state.gridState && (state.gridState[idx] & 1) !== 0;
    expect(isVisible, "Enemy cell should not be visible").toBe(false);

    // Should be pruned
    expect(state.enemies.length).toBe(0); 
  });

  it("should NOT prune enemies when debug mode is ON", () => {
    map.walls = [
        { p1: { x: 2, y: 0 }, p2: { x: 2, y: 1 } },
        { p1: { x: 2, y: 1 }, p2: { x: 2, y: 2 } },
        { p1: { x: 2, y: 2 }, p2: { x: 2, y: 3 } },
        { p1: { x: 2, y: 3 }, p2: { x: 2, y: 4 } },
        { p1: { x: 2, y: 4 }, p2: { x: 2, y: 5 } },
    ];
    const engine = new CoreEngine(
      map,
      123,
      { soldiers: [], inventory: {} },
      true,
      true, // debugOverlayEnabled = true
    );
    engine.clearUnits();

    engine.addUnit({
      id: "s1",
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
        attackRange: 10,
        speed: 20,
      },
      commandQueue: [],
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      aiProfile: AIProfile.RUSH,
      engagementPolicy: "ENGAGE",
      aiEnabled: true,
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 4.5, y: 4.5 },
      hp: 100,
      maxHp: 100,
      type: EnemyType.SwarmMelee,
      damage: 10,
      fireRate: 100,
      accuracy: 1000,
      attackRange: 1,
      speed: 2,
      difficulty: 1,
    });

    engine.update(100);
    const state = engine.getState(true);

    expect(state.enemies.length).toBe(1);
    expect(state.enemies[0].id).toBe("e1");
  });
});
