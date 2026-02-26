import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  SquadConfig,
  AIProfile,
  EnemyType,
} from "@src/shared/types";

describe("Tactical AI Reproduction Tests", () => {
  let engine: CoreEngine;
  const mockMap: MapDefinition = {
    width: 20,
    height: 10,
    cells: [],
    spawnPoints: [],
    extraction: { x: 19, y: 1 },
    objectives: [],
  };

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 20; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor });
    }
  }

  beforeEach(() => {
    const defaultSquad: SquadConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };
    engine = new CoreEngine(mockMap, 123, defaultSquad, true, false); // agentControlEnabled = true
    engine.clearUnits();
  });

  it("1) Units in IGNORE mode should fire while moving", () => {
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 500,
        accuracy: 1000,
        soldierAim: 100,
        attackRange: 10,
        speed: 20, // 2 tiles/s
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      engagementPolicy: "IGNORE",
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 0.5 },
      hp: 1000,
      maxHp: 1000,
      type: EnemyType.XenoMite,
      damage: 10,
      fireRate: 1000,
      accuracy: 50,
      attackRange: 1,
      speed: 0,
      difficulty: 1,
    });

    // Give MOVE_TO command
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 10, y: 0 },
    });

    // Update twice to ensure AI processes and command starts executing
    engine.update(100); 
    engine.update(100);
    
    let state = engine.getState();
    let unit = state.units[0];
    let enemy = state.enemies[0];

    // Unit should be attacking while moving
    // CURRENT FAILURE: Received "Moving", expected "Attacking"
    expect(unit.state).toBe(UnitState.Attacking); 
    expect(unit.pos.x).toBeGreaterThan(0.5); // Should have moved
    
    const initialHP = enemy.hp;
    engine.update(500); // Should fire at least once
    
    state = engine.getState();
    enemy = state.enemies[0];
    unit = state.units[0];

    // CURRENT FAILURE: enemy.hp is still initialHP
    expect(enemy.hp).toBeLessThan(initialHP); 
    expect(unit.pos.x).toBeGreaterThan(1.0); // Should have continued moving
  });

  it("2) Units in AVOID mode should maintain LOS while kiting", () => {
    // Map with a corridor that ends and a side room
    const customMap: MapDefinition = {
        width: 20,
        height: 10,
        cells: [],
        spawnPoints: [],
        extraction: { x: 19, y: 1 },
    };
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 20; x++) {
            if (y === 1 && x >= 5 && x <= 6) { // Corridor from 5 to 6
                customMap.cells.push({ x, y, type: CellType.Floor });
            } else if (x === 6 && y >= 2 && y <= 4) { // Side Room at x=6, y=2..4
                customMap.cells.push({ x, y, type: CellType.Floor });
            } else {
                customMap.cells.push({ x, y, type: CellType.Void });
            }
        }
    }

    engine = new CoreEngine(customMap, 123, { soldiers: [], inventory: {} }, true, false);
    engine.clearUnits();

    engine.addUnit({
      id: "u1",
      pos: { x: 6.5, y: 1.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: { damage: 10, fireRate: 500, accuracy: 1000, soldierAim: 100, attackRange: 10, speed: 20, equipmentAccuracyBonus: 0 },
      aiProfile: AIProfile.RETREAT,
      commandQueue: [],
      engagementPolicy: "AVOID",
      archetypeId: "assault",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 5.5, y: 1.5 }, // Enemy in corridor at x=5
      hp: 1000,
      maxHp: 1000,
      type: EnemyType.XenoMite,
      damage: 10, fireRate: 1000, accuracy: 50, attackRange: 1, speed: 0, difficulty: 1,
    });

    // Discover the side room cells
    engine.getState().discoveredCells.push("6,2", "6,1", "5,1");

    engine.update(100);
    engine.update(100);
    
    const state = engine.getState();
    const unit = state.units[0];

    // Current flawed AI will pick (6.5, 2.5) because it's further (1.41) from enemy (5.5, 1.5) 
    // than the other walkable neighbor (5.5, 1.5) [dist 0].
    // But (6.5, 2.5) breaks LOS.
    // DESIRED: It should stay in corridor OR at least NOT break LOS.
    // Here we expect it to NOT move into the room (y=2.5)
    expect(unit.targetPos?.y).toBe(1.5);
  });

  it("3) VIPs should flee directly toward extraction", () => {
    engine.addUnit({
      id: "vip1",
      pos: { x: 5.5, y: 5.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: { damage: 0, fireRate: 0, accuracy: 0, soldierAim: 0, attackRange: 0, speed: 20, equipmentAccuracyBonus: 0 },
      aiProfile: AIProfile.RETREAT,
      commandQueue: [],
      archetypeId: "vip",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      aiEnabled: true,
    });

    engine.addEnemy({
      id: "e1",
      pos: { x: 7.5, y: 5.5 }, 
      hp: 1000,
      maxHp: 1000,
      type: EnemyType.XenoMite,
      damage: 10, fireRate: 1000, accuracy: 50, attackRange: 1, speed: 0, difficulty: 1,
    });

    // Extraction is at (19, 1). 
    // Discover cells around VIP to allow fleeing logic to have candidates.
    engine.getState().discoveredCells.push("19,1", "5,5", "6,5", "4,5", "5,4", "5,6", "4,4", "4,6");

    engine.update(100);
    engine.update(100);
    
    const state = engine.getState();
    const vip = state.units[0];

    // VIP should be moving toward extraction (19,1), even if enemy is at (7.5, 5.5)
    // CURRENT FAILURE: It picks a fleeing target away from enemy, e.g. x=4.5
    expect(vip.targetPos?.x).toBeGreaterThan(5.5);
  });
});
