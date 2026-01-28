import { describe, it, expect, beforeEach } from "vitest";
import {
  Unit,
  UnitState,
  WeaponLibrary,
  MapDefinition,
  CellType,
  AIProfile,
  GameState,
} from "@src/shared/types";
import { GameGrid } from "@src/engine/GameGrid";
import { Pathfinder } from "@src/engine/Pathfinder";
import { LineOfSight } from "@src/engine/LineOfSight";
import { UnitManager } from "@src/engine/managers/UnitManager";
import { PRNG } from "@src/shared/PRNG";
import { LootManager } from "@src/engine/managers/LootManager";

describe("Weapon System", () => {
  let unitManager: UnitManager;
  let gameGrid: GameGrid;
  let pathfinder: Pathfinder;
  let los: LineOfSight;
  let prng: PRNG;
  let lootManager: LootManager;

  beforeEach(() => {
    const map: MapDefinition = {
      width: 10,
      height: 10,
      cells: [],
    };
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.cells.push({ x, y, type: CellType.Floor });
      }
    }
    gameGrid = new GameGrid(map);
    const doors = new Map();
    pathfinder = new Pathfinder(gameGrid.getGraph(), doors);
    los = new LineOfSight(gameGrid.getGraph(), doors);
    unitManager = new UnitManager(gameGrid, pathfinder, los, true);
    prng = new PRNG(123);
    lootManager = new LootManager();
  });

  it("should have melee and ranged weapons defined in WeaponLibrary", () => {
    expect(WeaponLibrary).toBeDefined();
    expect(WeaponLibrary["combat_knife"]).toBeDefined();
    expect(WeaponLibrary["pistol"]).toBeDefined();
    expect(WeaponLibrary["pulse_rifle"]).toBeDefined();
  });

  it("should allow a unit to carry one melee and one ranged weapon", () => {
    const unit: Unit = {
      id: "u1",
      pos: { x: 1.5, y: 1.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      commandQueue: [],
      stats: {
        speed: 15,
        damage: 0,
        fireRate: 0,
        accuracy: 0,
        attackRange: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      archetypeId: "assault",
      leftHand: "combat_knife",
      rightHand: "pulse_rifle",
    } as unknown as Unit;

    expect(unit.leftHand).toBe("combat_knife");
    expect(unit.rightHand).toBe("pulse_rifle");
  });

  it("should switch to melee weapon when enemy is in melee range", () => {
    const map: MapDefinition = { width: 10, height: 10, cells: [] };
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.cells.push({ x, y, type: CellType.Floor });
      }
    }
    const unit: Unit = {
      id: "u1",
      pos: { x: 1.5, y: 1.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      commandQueue: [],
      stats: {
        speed: 20,
        damage: 20,
        fireRate: 600,
        accuracy: 95,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 4,
      },
      aiProfile: AIProfile.STAND_GROUND,
      archetypeId: "assault",
      leftHand: "combat_knife",
      rightHand: "pulse_rifle",
      activeWeaponId: "pulse_rifle",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    } as Unit;
    const enemy = {
      id: "e1",
      type: "Xeno-Mite",
      pos: { x: 1.5, y: 1.5 }, // Same cell
      hp: 50,
      maxHp: 50,
      damage: 15,
      fireRate: 400,
      accuracy: 50,
      attackRange: 1,
      speed: 30,
    };
    const state = {
      t: 0,
      units: [unit],
      enemies: [enemy],
      visibleCells: ["1,1"],
      discoveredCells: ["1,1"],
      map: map,
    } as unknown as GameState;

    unitManager.update(state, 100, new Map(), prng, lootManager);

    const updatedUnit = state.units[0];
    expect(updatedUnit.activeWeaponId).toBe("combat_knife");
    expect(updatedUnit.stats.damage).toBe(15); // Knife damage
    expect(updatedUnit.stats.attackRange).toBe(1); // Knife range
  });

  it("should switch to ranged weapon when enemy is at distance", () => {
    const map: MapDefinition = { width: 10, height: 10, cells: [] };
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.cells.push({ x, y, type: CellType.Floor });
      }
    }
    const unit: Unit = {
      id: "u1",
      pos: { x: 1.5, y: 1.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      commandQueue: [],
      stats: {
        speed: 20,
        damage: 15,
        fireRate: 400,
        accuracy: 100,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 1,
      },
      aiProfile: AIProfile.STAND_GROUND,
      archetypeId: "assault",
      leftHand: "combat_knife",
      rightHand: "pulse_rifle",
      activeWeaponId: "combat_knife",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    } as Unit;
    const enemy = {
      id: "e1",
      type: "Xeno-Mite",
      pos: { x: 4.5, y: 1.5 }, // 3 tiles away
      hp: 50,
      maxHp: 50,
      damage: 15,
      fireRate: 400,
      accuracy: 50,
      attackRange: 1,
      speed: 30,
    };
    const state = {
      t: 0,
      units: [unit],
      enemies: [enemy],
      visibleCells: ["1,1", "4,1"],
      discoveredCells: ["1,1", "4,1"],
      map: map,
    } as unknown as GameState;

    unitManager.update(state, 100, new Map(), prng, lootManager);

    const updatedUnit = state.units[0];
    expect(updatedUnit.activeWeaponId).toBe("pulse_rifle");
    expect(updatedUnit.stats.damage).toBe(20); // Pulse Rifle damage
    expect(updatedUnit.stats.attackRange).toBe(10); // Pulse Rifle range
  });
});
