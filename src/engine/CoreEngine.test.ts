import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoreEngine } from './CoreEngine';
import { CellType, UnitState, CommandType, MapDefinition, Vector2, SpawnPoint, Objective } from '../shared/types';
import { GameGrid } from './GameGrid';
import { Pathfinder } from './Pathfinder';

describe('CoreEngine with Objectives and Game Loop', () => {
  let engine: CoreEngine;
  const mockSpawnPoint: SpawnPoint = { id: 'sp1', pos: { x: 0, y: 0 }, radius: 1 };
  const mockObjective: Objective = { id: 'obj1', kind: 'Recover', state: 'Pending', targetCell: { x: 2, y: 0 } };
  const mockMap: MapDefinition = {
    width: 3, 
    height: 3,
    cells: [
      { x: 0, y: 0, type: CellType.Floor }, { x: 1, y: 0, type: CellType.Floor }, { x: 2, y: 0, type: CellType.Floor },
      { x: 0, y: 1, type: CellType.Floor }, { x: 1, y: 1, type: CellType.Wall  }, { x: 2, y: 1, type: CellType.Floor },
      { x: 0, y: 2, type: CellType.Floor }, { x: 1, y: 2, type: CellType.Floor }, { x: 2, y: 2, type: CellType.Floor },
    ],
    spawnPoints: [mockSpawnPoint],
    extraction: { x: 0, y: 2 }, 
    objectives: [mockObjective]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new CoreEngine(mockMap, 12345); 
    engine.clearUnits(); // Clear default squad
    engine.addUnit({
      id: 'u1',
      pos: { x: 0.5, y: 0.5 }, 
      hp: 100, maxHp: 100,
      state: UnitState.Idle,
      damage: 20, attackRange: 2, sightRange: 5
    });
  });

  it('should complete objective when unit reaches target', () => {
    // Objective at (2,0). Move unit there.
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ['u1'],
      target: { x: 2, y: 0 }
    });

    // Move takes time. Distance 2. Speed 2. 1 second.
    for (let i = 0; i < 15; i++) engine.update(100);

    const state = engine.getState();
    expect(state.objectives[0].state).toBe('Completed');
  });

  it('should extract unit at extraction point', () => {
    // Extraction at (0,2). Move unit there.
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ['u1'],
      target: { x: 0, y: 2 }
    });

    for (let i = 0; i < 20; i++) engine.update(100); // Allow time to travel
    
    const state = engine.getState();
    const unit = state.units[0];
    expect(unit.state).toBe(UnitState.Extracted);
  });

  it('should win game when objectives complete and units extract', () => {
    // 1. Complete objective at (2,0)
    engine.applyCommand({ type: CommandType.MOVE_TO, unitIds: ['u1'], target: { x: 2, y: 0 } });
    for (let i = 0; i < 15; i++) engine.update(100);
    
    expect(engine.getState().objectives[0].state).toBe('Completed');

    // 2. Return to extraction at (0,2)
    engine.applyCommand({ type: CommandType.MOVE_TO, unitIds: ['u1'], target: { x: 0, y: 2 } });
    for (let i = 0; i < 25; i++) engine.update(100); // 2.5s to return

    const state = engine.getState();
    expect(state.units[0].state).toBe(UnitState.Extracted);
    expect(state.status).toBe('Won');
  });

  it('should lose game if all units die', () => {
    // Spawn powerful enemy at (0,0) - same cell as unit
    engine.addEnemy({
      id: 'boss',
      pos: { x: 0.5, y: 0.5 },
      hp: 500, maxHp: 500,
      type: 'Boss',
      damage: 1000, attackRange: 1
    });

    engine.update(100);

    const state = engine.getState();
    const unit = state.units[0];
    expect(unit.state).toBe(UnitState.Dead);
    expect(state.status).toBe('Lost');
  });

  it('should lose game if units extract without completing objectives', () => {
    // Move to extraction at (0,2)
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ['u1'],
      target: { x: 0, y: 2 }
    });
    for (let i = 0; i < 20; i++) engine.update(100);
    
    const state = engine.getState();
    expect(state.units[0].state).toBe(UnitState.Extracted);
    // Objective pending. No active units.
    expect(state.status).toBe('Lost');
  });
});
