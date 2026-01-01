import { describe, it, expect, beforeEach } from "vitest";
import { UnitManager } from "../managers/UnitManager";
import { GameGrid } from "../GameGrid";
import { Pathfinder } from "../Pathfinder";
import { LineOfSight } from "../LineOfSight";
import { PRNG } from "../../shared/PRNG";
import {
  GameState,
  UnitState,
  CellType,
  Door,
  Unit,
  Enemy,
  EnemyType,
  MapDefinition,
} from "../../shared/types";

describe("UnitManager Combat (15hj)", () => {
  let grid: GameGrid;
  let pathfinder: Pathfinder;
  let los: LineOfSight;
  let unitManager: UnitManager;
  let doors: Map<string, Door>;
  let prng: PRNG;

  beforeEach(() => {
    const map: MapDefinition = {
      width: 10,
      height: 10,
      cells: [],
      doors: [],
    };
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.cells.push({ x, y, type: CellType.Floor });
      }
    }
    doors = new Map();
    grid = new GameGrid(map);
    pathfinder = new Pathfinder(grid.getGraph(), doors);
    los = new LineOfSight(grid.getGraph(), doors);
    unitManager = new UnitManager(grid, pathfinder, los, true);
    prng = new PRNG(123);
  });

  it("should detect enemy (LOS) but NOT shoot (LOF) through opening door", () => {
    const doorId = "door1";
    const door: Door = {
      id: doorId,
      segment: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      orientation: "Vertical",
      state: "Closed",
      targetState: "Open", // Door is opening
      hp: 100,
      maxHp: 100,
      openDuration: 1000,
    };

    const map: MapDefinition = {
      width: 10,
      height: 10,
      cells: [],
      doors: [door],
    };
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        map.cells.push({ x, y, type: CellType.Floor });
      }
    }

    doors = new Map();
    doors.set(doorId, door);
    grid = new GameGrid(map);
    pathfinder = new Pathfinder(grid.getGraph(), doors);
    los = new LineOfSight(grid.getGraph(), doors);
    unitManager = new UnitManager(grid, pathfinder, los, true);

    const unit: Unit = {
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      speed: 10,
      state: UnitState.Idle,
      commandQueue: [],
      attackRange: 5,
      damage: 10,
      fireRate: 100,
      accuracy: 100,
      sightRange: 10,
    } as any;

    const enemy: Enemy = {
      id: "e1",
      pos: { x: 2.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      type: EnemyType.SwarmMelee,
      state: "Idle",
      attackRange: 1,
      damage: 10,
      fireRate: 1000,
      accuracy: 50,
    } as any;

    const state: GameState = {
      t: 0,
      units: [unit],
      enemies: [enemy],
      map: { width: 10, height: 10, cells: [], doors: [] },
      visibleCells: los.computeVisibleCells(unit.pos, 10),
      discoveredCells: [],
      objectives: [],
      aliensKilled: 0,
    } as any;

    // Verify LOS exists but LOF doesn't
    expect(los.hasLineOfSight(unit.pos, enemy.pos)).toBe(true);
    expect(los.hasLineOfFire(unit.pos, enemy.pos)).toBe(false);

    unitManager.update(state, 100, doors, prng);

    // Unit should be in Attacking state (because it has LOS and is in range)
    // OR should it? If it can't fire, maybe it shouldn't be in Attacking state?
    // The requirement says "maintaining hasLineOfSight for target acquisition".
    // If target is acquired, unit usually stops and tries to shoot.

    // Check if enemy took damage
    expect(enemy.hp).toBe(100); // Should NOT have taken damage

    // Current behavior: unit.state becomes Attacking only if hasLineOfFire is true.
    // Wait, let's check the code again.
    /*
        if (this.los.hasLineOfFire(unit.pos, targetEnemy.pos)) {
          // ...
          unit.state = UnitState.Attacking;
          isAttacking = true;
        }
    */
    // If hasLineOfFire is false, isAttacking is false, and unit.state is NOT set to Attacking here.
    // Then it goes to:
    /*
      } else if (!isAttacking && !isMoving) {
          unit.state = UnitState.Idle;
      }
    */
    expect(unit.state).toBe(UnitState.Idle);
  });
});
