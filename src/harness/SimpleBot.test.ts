import { describe, it, expect } from 'vitest';
import { SimpleBot } from './SimpleBot';
import { GameState, UnitState, CommandType, Objective, MapDefinition, Unit, Enemy } from '../shared/types';

describe('SimpleBot', () => {
  const mockMap: MapDefinition = { width: 10, height: 10, cells: [], extraction: { x: 0, y: 0 } };
  const mockObjective: Objective = { id: 'o1', kind: 'Recover', state: 'Pending', targetCell: { x: 5, y: 5 } };
  
  const baseState: GameState = {
    t: 0,
    map: { ...mockMap, objectives: [mockObjective] },
    units: [{ id: 'u1', pos: { x: 0, y: 0 }, state: UnitState.Idle, hp: 100, maxHp: 100, damage: 10, attackRange: 1, sightRange: 10, commandQueue: [] }],
    enemies: [],
    visibleCells: [],
    discoveredCells: [],
    objectives: [mockObjective],
    status: 'Playing'
  };

  it('should move to pending objective', () => {
    const bot = new SimpleBot();
    const cmd = bot.act(baseState);
    
    expect(cmd).not.toBeNull();
    expect(cmd?.type).toBe(CommandType.MOVE_TO);
    expect(cmd?.target).toEqual({ x: 5, y: 5 });
  });

  it('should move to extraction if objectives complete', () => {
    const bot = new SimpleBot();
    const completedState = {
      ...baseState,
      objectives: [{ ...mockObjective, state: 'Completed' } as Objective]
    };
    
    const cmd = bot.act(completedState);
    
    expect(cmd).not.toBeNull();
    expect(cmd?.type).toBe(CommandType.MOVE_TO);
    expect(cmd?.target).toEqual({ x: 0, y: 0 }); // Extraction
  });

  it('should do nothing if moving', () => {
    const bot = new SimpleBot();
    const movingState = {
      ...baseState,
      units: [{ ...baseState.units[0], state: UnitState.Moving }]
    };
    
    const cmd = bot.act(movingState);
    expect(cmd).toBeNull();
  });
});