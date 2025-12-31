import { describe, it, expect, beforeEach } from "vitest";
import {
  Unit,
  UnitState,
  ArchetypeLibrary,
  WeaponLibrary,
  MapDefinition,
  CellType,
} from "../../../shared/types";
import { GameGrid } from "../../GameGrid";
import { Pathfinder } from "../../Pathfinder";
import { LineOfSight } from "../../LineOfSight";
import { UnitManager } from "../../managers/UnitManager";
import { PRNG } from "../../../shared/PRNG";

describe("Weapon System", () => {
  let unitManager: UnitManager;
  let gameGrid: GameGrid;
  let pathfinder: Pathfinder;
  let los: LineOfSight;
  let prng: PRNG;

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
    pathfinder = new Pathfinder(gameGrid.getGraph(), new Map());
    los = new LineOfSight(gameGrid.getGraph(), new Map());
    unitManager = new UnitManager(gameGrid, pathfinder, los, true);
    prng = new PRNG(123);
  });

  it("should have melee and ranged weapons defined in WeaponLibrary", () => {
    expect(WeaponLibrary).toBeDefined();
    expect(WeaponLibrary["knife"]).toBeDefined();
    expect(WeaponLibrary["pistol"]).toBeDefined();
    expect(WeaponLibrary["pulse_rifle"]).toBeDefined();
  });

  it("should allow a unit to carry one melee and one ranged weapon", () => {
    const unit: any = {
      id: "u1",
      pos: { x: 1.5, y: 1.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      commandQueue: [],
      speed: 15,
      archetypeId: "assault",
      leftHand: "knife",
      rightHand: "pulse_rifle",
      // Current stats for backward compatibility or as "active" stats
      damage: 0,
      fireRate: 0,
      accuracy: 0,
      attackRange: 0,
    };

    expect(unit.leftHand).toBe("knife");
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
      speed: 20,
      archetypeId: "assault",
      leftHand: "knife",
      rightHand: "pulse_rifle",
      activeWeaponId: "pulse_rifle",
      damage: 20,
      fireRate: 600,
      accuracy: 95,
      soldierAim: 90,
      equipmentAccuracyBonus: 0,
      attackRange: 4,
      sightRange: 100,
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
    const state: any = {
      t: 0,
      units: [unit],
      enemies: [enemy],
      visibleCells: ["1,1"],
      discoveredCells: ["1,1"],
      map: map,
    };

    unitManager.update(state, 100, new Map(), prng);

    expect(unit.activeWeaponId).toBe("knife");
    expect(unit.damage).toBe(15); // Knife damage
    expect(unit.attackRange).toBe(1); // Knife range
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
      speed: 20,
      archetypeId: "assault",
      leftHand: "knife",
      rightHand: "pulse_rifle",
      activeWeaponId: "knife",
      damage: 15,
      fireRate: 400,
      accuracy: 100,
      soldierAim: 90,
      equipmentAccuracyBonus: 0,
      attackRange: 1,
      sightRange: 100,
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
    const state: any = {
      t: 0,
      units: [unit],
      enemies: [enemy],
      visibleCells: ["1,1", "4,1"],
      discoveredCells: ["1,1", "4,1"],
      map: map,
    };

    unitManager.update(state, 100, new Map(), prng);

    expect(unit.activeWeaponId).toBe("pulse_rifle");
    expect(unit.damage).toBe(20); // Pulse Rifle damage
    expect(unit.attackRange).toBe(10); // Pulse Rifle range
  });
});
