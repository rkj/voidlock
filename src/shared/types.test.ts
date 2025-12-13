import { describe, it, expect } from 'vitest';
import { CellType, UnitState, CommandType, Vector2, Grid, Entity, Unit, Enemy } from './types';

describe('Shared Types', () => {
  it('should have correct enum values', () => {
    expect(CellType.Wall).toBe('Wall');
    expect(UnitState.Moving).toBe('Moving');
    expect(CommandType.MOVE_TO).toBe('MOVE_TO');
  });

  it('should allow Vector2 creation', () => {
    const v: Vector2 = { x: 10, y: 20 };
    expect(v.x).toBe(10);
    expect(v.y).toBe(20);
  });

  it('should define a Grid interface with isWalkable', () => {
    const mockGrid: Grid = {
      width: 10,
      height: 10,
      isWalkable: (x, y) => x > 0 && y > 0
    };
    expect(mockGrid.width).toBe(10);
    expect(mockGrid.isWalkable(1, 1)).toBe(true);
    expect(mockGrid.isWalkable(0, 0)).toBe(false);
  });

  it('should include path in Unit type', () => {
    const unitWithOutPath: Unit = {
      id: 'u1',
      pos: { x: 0, y: 0 },
      hp: 100, maxHp: 100,
      state: UnitState.Idle
    };
    expect(unitWithOutPath).not.toHaveProperty('path');

    const unitWithPath: Unit = {
      id: 'u2',
      pos: { x: 0, y: 0 },
      hp: 100, maxHp: 100,
      state: UnitState.Moving,
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }]
    };
    expect(unitWithPath.path).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
  });

  it('should define Entity and Enemy types', () => {
    const entity: Entity = {
      id: 'e1',
      pos: { x: 5, y: 5 },
      hp: 50,
      maxHp: 50
    };
    expect(entity.id).toBe('e1');
    expect(entity.hp).toBe(50);

    const enemy: Enemy = {
      id: 'z1',
      pos: { x: 10, y: 10 },
      hp: 30,
      maxHp: 30,
      type: 'SwarmMelee'
    };
    expect(enemy.id).toBe('z1');
    expect(enemy.type).toBe('SwarmMelee');
    expect(enemy.hp).toBe(30);
  });
});
