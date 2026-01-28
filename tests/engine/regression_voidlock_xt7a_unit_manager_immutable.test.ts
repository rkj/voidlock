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

describe("UnitManager Immutable Integration Regression", () => {
  let engine: CoreEngine;
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
    spawnPoints: [],
    extraction: { x: 9, y: 9 },
    objectives: [],
  };

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor });
    }
  }

  beforeEach(() => {
    const defaultSquad: SquadConfig = {
      soldiers: [{ archetypeId: "scout" }],
      inventory: {},
    };
    engine = new CoreEngine(mockMap, 123, defaultSquad, false, false);
    engine.clearUnits();
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 20,
        fireRate: 500,
        accuracy: 1000,
        soldierAim: 100, // Guaranteed hit
        attackRange: 5,
        speed: 200,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "scout",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });
  });

  it("unit should move to target when not attacking", () => {
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ["u1"],
      target: { x: 5, y: 5 },
    });

    const initialState = engine.getState();
    const initialPos = initialState.units[0].pos;
    
    // Update a few times
    for (let i = 0; i < 5; i++) {
        engine.update(100);
    }

    const state = engine.getState();
    const unit = state.units[0];
    
    // Check if it moved at all
    const moved = unit.pos.x !== initialPos.x || unit.pos.y !== initialPos.y;
    expect(moved).toBe(true);
    expect(unit.state).toBe(UnitState.Moving);
  });

  it("unit should shoot at enemy and stay in attacking state", () => {
    // Add an enemy in range
    engine.addEnemy({
        id: "e1",
        type: EnemyType.XenoMite,
        pos: { x: 2.5, y: 0.5 },
        hp: 100,
        maxHp: 100,
        damage: 10,
        fireRate: 500,
        accuracy: 1000,
        attackRange: 2,
        speed: 1,
        difficulty: 1,
    });
    
    // Wait for combat to start
    engine.update(100);
    
    const state = engine.getState();
    const unit = state.units[0];
    const enemy = state.enemies[0];
    
        expect(unit.state).toBe(UnitState.Attacking);
    
        expect(enemy.hp).toBeLessThan(enemy.maxHp);
    
      });
    
    
    
      it("escort logic should correctly update unit positions without mutation issues", () => {
    
        // Add VIP
    
        engine.addUnit({
    
            id: "vip",
    
            pos: { x: 1.5, y: 1.5 },
    
            hp: 100,
    
            maxHp: 100,
    
            state: UnitState.Idle,
    
            stats: {
    
              damage: 0,
    
              fireRate: 0,
    
              accuracy: 0,
    
              soldierAim: 0,
    
              attackRange: 0,
    
              speed: 10,
    
              equipmentAccuracyBonus: 0,
    
            },
    
            aiProfile: AIProfile.STAND_GROUND,
    
            commandQueue: [],
    
            archetypeId: "vip",
    
            kills: 0,
    
            damageDealt: 0,
    
            objectivesCompleted: 0,
    
        });
    
    
    
        // Order u1 to escort vip
    
        engine.applyCommand({
    
            type: CommandType.ESCORT_UNIT,
    
            unitIds: ["u1"],
    
            targetId: "vip",
    
        });
    
    
    
        // Order vip to move
    
        engine.applyCommand({
    
            type: CommandType.MOVE_TO,
    
            unitIds: ["vip"],
    
            target: { x: 5, y: 5 },
    
        });
    
    
    
        // Update for a few ticks
    
        for (let i = 0; i < 5; i++) {
    
            engine.update(100);
    
        }
    
    
    
        const state = engine.getState();
    
        const u1 = state.units.find(u => u.id === "u1")!;
    
        const vip = state.units.find(u => u.id === "vip")!;
    
    
    
        expect(vip.state).toBe(UnitState.Moving);
    
        expect(u1.activeCommand?.type).toBe(CommandType.ESCORT_UNIT);
    
        // u1 should also be moving to follow vip
    
        expect(u1.state).toBe(UnitState.Moving);
    
      });
    
    });
    
    