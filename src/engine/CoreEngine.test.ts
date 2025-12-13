import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoreEngine } from './CoreEngine';
import { CellType, UnitState, CommandType, MapDefinition, Vector2 } from '../shared/types';
import { GameGrid } from './GameGrid';
import { Pathfinder } from './Pathfinder';

// Removed mocks for GameGrid and Pathfinder to test CoreEngine with actual dependencies


describe('CoreEngine with Pathfinding and Combat', () => {
  let engine: CoreEngine;
  const mockMap: MapDefinition = {
    width: 3, // Smaller map for simpler pathfinding
    height: 1,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 2, y: 0, type: CellType.Floor },
    ],
  };

  beforeEach(() => {
    // Reset mocks (if any are still somehow active, though removed above)
    vi.clearAllMocks();

    engine = new CoreEngine(mockMap);
    engine.addUnit({
      id: 'u1',
      pos: { x: 0.5, y: 0.5 }, // Units start at half-cell for movement to center
      hp: 100, maxHp: 100,
      state: UnitState.Idle,
      damage: 20, attackRange: 1,
    });
  });

  it('should process MOVE_TO command and set unit path', () => {
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ['u1'],
      target: { x: 2, y: 0 },
    });

    const state = engine.getState();
    const unit = state.units[0];
    expect(unit.state).toBe(UnitState.Moving);
    expect(unit.path).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]); // Path should be calculated
    expect(unit.targetPos).toEqual({ x: 1.5, y: 0.5 }); // Expect center of first step
  });

  it('should move unit along the path over time', () => {
    // Rely on applyCommand to set up the initial path
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ['u1'],
      target: { x: 2, y: 0 },
    });
    
    // Segment 1: Move from (0.5, 0.5) to center of (1,0) which is (1.5, 0.5)
    // Distance in x = 1. Updates needed = 1 / 0.2 = 5 updates
    for (let i = 0; i < 5; i++) {
        engine.update(100);
    }
    let unit = engine.getState().units[0]; // Re-fetch unit after updates

    expect(unit.pos.x).toBeCloseTo(1.5);
    expect(unit.pos.y).toBeCloseTo(0.5);
    expect(unit.path).toEqual([{ x: 2, y: 0 }]); // Path should have shifted
    expect(unit.targetPos).toEqual({ x: 2.5, y: 0.5 }); // Target should be center of next path segment

    // Segment 2: Move from (1.5, 0.5) to center of (2,0) which is (2.5, 0.5)
    // Distance in x = 1. Updates needed = 1 / 0.2 = 5 updates
    for (let i = 0; i < 5; i++) {
        engine.update(100);
    }

    unit = engine.getState().units[0]; // Re-fetch unit after updates

    expect(unit.pos.x).toBeCloseTo(2.5); // Should be at center of target cell
    expect(unit.pos.y).toBeCloseTo(0.5);
    expect(unit.state).toBe(UnitState.Idle);
    expect(unit.path).toBeUndefined();
    expect(unit.targetPos).toBeUndefined();
  });

  it('should handle no path found', () => {
    engine.addUnit({
        id: 'u2',
        pos: { x: 0.5, y: 0.5 },
        hp: 100, maxHp: 100,
        state: UnitState.Idle,
        damage: 10, attackRange: 1,
    });
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ['u2'],
      target: { x: 9, y: 9 }, // Target to an unreachable cell (outside mockMap range)
    });

    const state = engine.getState();
    const unit = state.units[1];
    expect(unit.state).toBe(UnitState.Idle);
    expect(unit.path).toBeUndefined();
    expect(unit.targetPos).toBeUndefined();
  });

  it('should handle unit already at target', () => {
    engine.addUnit({
        id: 'u3',
        pos: { x: 2.5, y: 0.5 }, // Unit already at center of cell (2,0)
        hp: 100, maxHp: 100,
        state: UnitState.Idle,
        damage: 10, attackRange: 1,
    });
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ['u3'],
      target: { x: 2, y: 0 }, // Target is cell (2,0)
    });

    const state = engine.getState();
    const unit = state.units[1]; // u3 is at index 1 now.
    expect(unit.state).toBe(UnitState.Idle);
    expect(unit.path).toBeUndefined();
    expect(unit.targetPos).toBeUndefined();
  });

  it('should allow adding enemies to the state', () => {
    engine.addEnemy({
      id: 'e1',
      pos: { x: 1.5, y: 0.5 },
      hp: 50, maxHp: 50,
      type: 'SwarmMelee',
      damage: 5, attackRange: 1,
    });

    const state = engine.getState();
    expect(state.enemies.length).toBe(1);
    expect(state.enemies[0].id).toBe('e1');
    expect(state.enemies[0].type).toBe('SwarmMelee');
  });

  it('should attack enemies in range', () => {
    // Unit u1 at (0.5, 0.5), attackRange = 1
    engine.addEnemy({
      id: 'e1',
      pos: { x: 1.5, y: 0.5 }, // Enemy is 1 unit away, in range
      hp: 50, maxHp: 50,
      type: 'SwarmMelee',
      damage: 5, attackRange: 1,
    });

    engine.update(100); // Trigger update to resolve combat

    const state = engine.getState();
    const enemy = state.enemies[0];
    const unit = state.units[0];

    expect(enemy.hp).toBe(50 - unit.damage); // Enemy should take damage
    expect(unit.state).toBe(UnitState.Attacking); // Unit should be in attacking state
  });

  it('should not attack enemies out of range', () => {
    // Unit u1 at (0.5, 0.5), attackRange = 1
    engine.addEnemy({
      id: 'e1',
      pos: { x: 2.5, y: 0.5 }, // Enemy is 2 units away, out of range
      hp: 50, maxHp: 50,
      type: 'SwarmMelee',
      damage: 5, attackRange: 1,
    });

    engine.update(100); // Trigger update

    const state = engine.getState();
    const enemy = state.enemies[0];
    const unit = state.units[0];

    expect(enemy.hp).toBe(50); // Enemy should not take damage
    expect(unit.state).toBe(UnitState.Idle); // Unit should remain idle if not moving or attacking
  });

  it('should remove defeated enemies', () => {
    // Unit u1 at (0.5, 0.5), damage = 20
    engine.addEnemy({
      id: 'e1',
      pos: { x: 1.5, y: 0.5 }, // In range
      hp: 10, maxHp: 10, // Low HP
      type: 'SwarmMelee',
      damage: 5, attackRange: 1,
    });

    engine.update(100); // Unit attacks, enemy HP becomes 10 - 20 = -10

    const state = engine.getState();
    expect(state.enemies.length).toBe(0); // Enemy should be removed
  });

  it('should damage soldiers when attacked by enemies', () => {
    // Unit u1 at (0.5, 0.5), hp = 100
    engine.addEnemy({
      id: 'e1',
      pos: { x: 1.5, y: 0.5 }, // In range (1 tile)
      hp: 50, maxHp: 50,
      type: 'SwarmMelee',
      damage: 15, attackRange: 1,
    });

    engine.update(100);

    const state = engine.getState();
    const unit = state.units[0];
    
    // Enemy damages unit
    expect(unit.hp).toBe(100 - 15);
  });

  it('should remove dead soldiers', () => {
    // Unit u1 (hp=100) will be killed by powerful enemy
    engine.addEnemy({
      id: 'boss',
      pos: { x: 1.5, y: 0.5 },
      hp: 500, maxHp: 500,
      type: 'Boss',
      damage: 100, attackRange: 1,
    });

    engine.update(100);

    const state = engine.getState();
    expect(state.units.length).toBe(0); // Unit should be dead and removed
  });
});