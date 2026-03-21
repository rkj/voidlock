import { describe, it, expect, beforeEach, vi } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  SquadConfig,
  CommandType,
  UnitState,
  CellType,
  EnemyType,
  BoundaryType,
} from "@src/shared/types";

describe("AI Invalidation Triggers (ADR 0056)", () => {
  let engine: CoreEngine;
  let map: MapDefinition;

  const squadConfig: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }],
    inventory: {},
  };

  beforeEach(() => {
    map = {
      width: 20,
      height: 20,
      cells: [],
      spawnPoints: [{ id: "sp1", pos: { x: 0.5, y: 0.5 }, radius: 1 }],
      squadSpawns: [{ x: 0.5, y: 0.5 }],
      objectives: [],
      walls: [],
    };

    // Fill cells with floor
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        map.cells.push({ x, y, type: CellType.Floor });
      }
    }

    // Add multiple walls to block LOS and ensure undiscovered areas remain
    for (let y = 0; y < 20; y++) {
        if (y === 10) continue; 
        map.walls?.push({ p1: { x: 5, y: y }, p2: { x: 5, y: y + 1 } });
    }
    for (let y = 0; y < 20; y++) {
        if (y === 5) continue; 
        map.walls?.push({ p1: { x: 10, y: y }, p2: { x: 10, y: y + 1 } });
    }

    engine = new CoreEngine({
      map: map,
      seed: 123,
      squadConfig: squadConfig,
      agentControlEnabled: true,
      debugOverlayEnabled: false
    });
  });

  it("should invalidate Exploration plan when a new enemy enters LOS", () => {
    // 1. Force an exploration plan
    let unit = engine.getState().units[0];
    for (let i = 0; i < 40 && (!unit.activePlan || unit.activePlan.behavior !== "Exploring"); i++) {
      engine.update(16);
      unit = engine.getState().units[0];
    }
    
    expect(unit.activePlan).toBeDefined();
    expect(unit.activePlan?.behavior).toBe("Exploring");
    const oldGoal = unit.activePlan!.goal;

    // 2. Spawn an enemy in LOS
    engine.addEnemy({
      id: "enemy1",
      type: EnemyType.XenoMite,
      pos: { x: 2.5, y: 2.5 },
      hp: 50,
      maxHp: 50,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 1000,
      accuracy: 50,
      attackRange: 1,
      speed: 20,
      difficulty: 1,
    });

    // 3. Update engine and check if plan is invalidated and replaced
    engine.update(16);
    
    const updatedUnit = engine.getState().units[0];
    // Should have re-evaluated to Combat (priority 2 or 0)
    expect(updatedUnit.activePlan?.priority).toBeLessThan(4);
    expect(updatedUnit.activePlan?.goal).not.toEqual(oldGoal);
  });

  it("should invalidate Combat plan when all visible enemies die", () => {
    // 1. Spawn enemy to trigger Combat plan
    engine.addEnemy({
        id: "enemy1",
        type: EnemyType.XenoMite,
        pos: { x: 2.5, y: 2.5 },
        hp: 50,
        maxHp: 50,
        state: UnitState.Idle,
        damage: 10,
        fireRate: 1000,
        accuracy: 50,
        attackRange: 1,
        speed: 20,
        difficulty: 1,
      });

    // 2. Run until unit has a combat plan
    let unit = engine.getState().units[0];
    for (let i = 0; i < 40 && (!unit.activePlan || unit.activePlan.priority > 2); i++) {
      engine.update(16);
      unit = engine.getState().units[0];
    }
    
    expect(unit.activePlan).toBeDefined();
    expect(unit.activePlan?.priority).toBeLessThanOrEqual(2);

    // 3. Kill the enemy
    engine.clearEnemies();

    // 4. Update and check if plan is invalidated and replaced
    engine.update(16);
    
    const updatedUnit = engine.getState().units[0];
    // Should have re-evaluated to Exploration (priority 4)
    expect(updatedUnit.activePlan?.priority).toBe(4);
  });

  it("should invalidate plan when HP drops below 25%", () => {
     // 1. Spawn an enemy to provide a threat
     engine.addEnemy({
        id: "enemy1",
        type: EnemyType.XenoMite,
        pos: { x: 2.5, y: 2.5 },
        hp: 50,
        maxHp: 50,
        state: UnitState.Idle,
        damage: 10,
        fireRate: 1000,
        accuracy: 50,
        attackRange: 1,
        speed: 20,
        difficulty: 1,
      });

     // 2. Run until unit has a combat plan
     let unit = engine.getState().units[0];
     for (let i = 0; i < 40 && (!unit.activePlan || unit.activePlan.priority > 2); i++) {
       engine.update(16);
       unit = engine.getState().units[0];
     }
     expect(unit.activePlan?.priority).toBeLessThanOrEqual(2);

     // 3. Reduce HP to < 25% and put enemy ON TOP of unit to force retreat
     const internalState = (engine as any).state;
     internalState.units[0].hp = 10;
     internalState.units[0].maxHp = 100;
     internalState.enemies[0].pos = { ...internalState.units[0].pos };

     // 4. Update and check re-evaluation
     engine.update(16);
     
     const updatedUnit = engine.getState().units[0];
     // Should have re-evaluated to Safety (priority 0)
     expect(updatedUnit.activePlan?.priority).toBe(0); 
  });

  it("should invalidate plan when path becomes blocked by a door", () => {
    // 1. Add a door to the map (using CELL coordinates for boundary)
    const doorId = "door1";
    const door: any = {
      id: doorId,
      pos: { x: 5, y: 10 },
      state: "Open",
      type: "Normal",
      segment: [{ x: 4, y: 10 }, { x: 5, y: 10 }]
    };
    
    const mapWithDoor = { 
        ...map, 
        walls: map.walls?.filter(w => !(w.p1.x === 5 && w.p1.y === 10 && w.p2.x === 5 && w.p2.y === 11)),
        doors: [door],
        boundaries: [
            { x1: 4, y1: 10, x2: 5, y2: 10, type: BoundaryType.Door, doorId: "door1" }
        ]
    };
    engine = new CoreEngine({
      map: mapWithDoor,
      seed: 123,
      squadConfig: squadConfig,
      agentControlEnabled: true,
      debugOverlayEnabled: false
    });

    // 2. Force an exploration plan
    let unit = engine.getState().units[0];
    for (let i = 0; i < 40 && (!unit.activePlan || unit.activePlan.priority !== 4); i++) {
        engine.update(16);
        unit = engine.getState().units[0];
    }
    expect(unit.activePlan?.priority).toBe(4);

    // 3. Teleport unit near the door and set state to Moving through it
    const internalState = (engine as any).state;
    internalState.units[0].pos = { x: 4.9, y: 10.5 };
    internalState.units[0].state = UnitState.Moving;
    internalState.units[0].targetPos = { x: 5.5, y: 10.5 };
    internalState.units[0].path = [{ x: 5, y: 10 }];

    // 4. Lock the door
    const d = engine.doors.get(doorId);
    if (d) d.state = "Locked";

    // 5. Update and check if plan is invalidated
    engine.update(16);
    
    const updatedUnit = engine.getState().units[0];
    // Invalidation resets to Idle. 
    // ExplorationBehavior won't find a path through Locked door, so it stays Idle.
    expect(updatedUnit.state).toBe(UnitState.Idle);
    expect(updatedUnit.activePlan).toBeUndefined();
  });

  it("should invalidate plan when a new area is revealed", () => {
    // 1. Force an exploration plan
    let unit = engine.getState().units[0];
    for (let i = 0; i < 40 && (!unit.activePlan || unit.activePlan.priority !== 4); i++) {
      engine.update(16);
      unit = engine.getState().units[0];
    }
    expect(unit.activePlan?.priority).toBe(4);

    // 2. Reveal a new area manually in engine state
    const internalState = (engine as any).state;
    // Cell (15, 15) is behind two walls, so it's undiscovered.
    internalState.discoveredCells.push("15,15");
    if (internalState.gridState) {
        internalState.gridState[15 * internalState.map.width + 15] |= 2; // bit 1: discovered
    }

    // 3. Update and check if plan is invalidated and refreshed
    engine.update(16);
    
    const updatedUnit = engine.getState().units[0];
    expect(updatedUnit.activePlan).toBeDefined();
  });

  it("should invalidate plan when objective state changes", () => {
    // 1. Add an objective
    const mapWithObj = {
        ...map,
        objectives: [
            { id: "obj1", kind: "Recover" as const, targetCell: { x: 15, y: 15 } }
        ]
    };
    engine = new CoreEngine({
      map: mapWithObj,
      seed: 123,
      squadConfig: squadConfig,
      agentControlEnabled: true,
      debugOverlayEnabled: false
    });

    // 2. Run until unit has an objective plan
    (engine as any).state.objectives[0].visible = true;
    
    let unit = engine.getState().units[0];
    for (let i = 0; i < 40 && (!unit.activePlan || unit.activePlan.priority !== 3); i++) {
      engine.update(16);
      unit = engine.getState().units[0];
    }
    expect(unit.activePlan?.priority).toBe(3);

    // 3. Change objective state in engine state
    (engine as any).state.objectives[0].state = "Completed";

    // 4. Update and check if plan is invalidated
    engine.update(16);
    
    const updatedUnit = engine.getState().units[0];
    // Objective is now completed, so it should have re-evaluated to Exploration
    expect(updatedUnit.activePlan?.priority).toBe(4);
  });

  it("should invalidate plan when unit reaches its goal", () => {
    // 1. Force an exploration plan
    let unit = engine.getState().units[0];
    for (let i = 0; i < 40 && (!unit.activePlan || unit.activePlan.priority !== 4); i++) {
      engine.update(16);
      unit = engine.getState().units[0];
    }
    expect(unit.activePlan).toBeDefined();
    expect(unit.activePlan?.priority).toBe(4);
    const goal = unit.activePlan!.goal;

    // 2. Teleport unit to goal and reset targetPos to simulate arrival
    const internalState = (engine as any).state;
    internalState.units[0].pos = { ...goal };
    internalState.units[0].state = UnitState.Idle;
    internalState.units[0].targetPos = undefined;
    internalState.units[0].path = undefined;

    // 3. Update and check if plan is invalidated and refreshed
    engine.update(16);
    
    const updatedUnit = engine.getState().units[0];
    expect(updatedUnit.activePlan).toBeDefined();
    // Re-evaluating should pick a NEW target
    expect(updatedUnit.activePlan?.goal).not.toEqual(goal);
  });

  it("should clear activePlan when a manual command is issued", () => {
    // 1. Force an exploration plan
    let unit = engine.getState().units[0];
    for (let i = 0; i < 40 && (!unit.activePlan || unit.activePlan.priority !== 4); i++) {
      engine.update(16);
      unit = engine.getState().units[0];
    }
    expect(unit.activePlan).toBeDefined();

    // 2. Issue a manual move command
    engine.applyCommand({
        type: CommandType.MOVE_TO,
        unitIds: [unit.id],
        target: { x: 1, y: 1 }
    });

    // 3. Check if activePlan was cleared immediately
    const updatedUnit = engine.getState().units[0];
    expect(updatedUnit.activePlan).toBeUndefined();
    expect(updatedUnit.aiEnabled).toBe(false);
  });
});
