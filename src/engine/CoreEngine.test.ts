import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoreEngine } from './CoreEngine';
import { CellType, UnitState, CommandType, MapDefinition, Vector2, SpawnPoint } from '../shared/types';
import { GameGrid } from './GameGrid';
import { Pathfinder } from './Pathfinder';

// Removed mocks for GameGrid and Pathfinder to test CoreEngine with actual dependencies


describe('CoreEngine with Pathfinding, Combat, Director, and FoW', () => {
  let engine: CoreEngine;
  const mockSpawnPoint: SpawnPoint = { id: 'sp1', pos: { x: 0, y: 0 }, radius: 1 };
  const mockMap: MapDefinition = {
    width: 3, 
    height: 3, // Increased size for visibility tests
    cells: [
      { x: 0, y: 0, type: CellType.Floor }, { x: 1, y: 0, type: CellType.Floor }, { x: 2, y: 0, type: CellType.Floor },
      { x: 0, y: 1, type: CellType.Floor }, { x: 1, y: 1, type: CellType.Wall  }, { x: 2, y: 1, type: CellType.Floor }, // Wall at (1,1)
      { x: 0, y: 2, type: CellType.Floor }, { x: 1, y: 2, type: CellType.Floor }, { x: 2, y: 2, type: CellType.Floor },
    ],
    spawnPoints: [mockSpawnPoint]
  };

  beforeEach(() => {
    // Reset mocks (if any are still somehow active, though removed above)
    vi.clearAllMocks();

    engine = new CoreEngine(mockMap);
    engine.addUnit({
      id: 'u1',
      pos: { x: 0.5, y: 0.5 }, 
      hp: 100, maxHp: 100,
      state: UnitState.Idle,
      damage: 20, attackRange: 2, sightRange: 5
    });
  });

  // ... (Previous tests, adjusted for map size if needed) ...
  // Re-adding essential tests:

  it('should process MOVE_TO command and set unit path', () => {
    engine.applyCommand({
      type: CommandType.MOVE_TO,
      unitIds: ['u1'],
      target: { x: 2, y: 0 },
    });

    const state = engine.getState();
    const unit = state.units[0];
    expect(unit.state).toBe(UnitState.Moving);
    expect(unit.path).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]); 
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
  });

  it('should update visible and discovered cells', () => {
    engine.update(100);
    const state = engine.getState();
    
    // Unit at (0.5, 0.5). Should see (0,0), (1,0), (0,1), etc.
    expect(state.visibleCells).toContain('0,0');
    expect(state.visibleCells).toContain('1,0');
    expect(state.visibleCells).toContain('1,1'); // Wall is visible
    expect(state.discoveredCells).toContain('0,0');
  });

  it('should not see through walls', () => {
    // Unit at (0.5, 0.5). Wall at (1,1). (2,2) is behind wall?
    // Ray (0.5, 0.5) -> (2.5, 2.5) passes through (1.5, 1.5) center of wall?
    // Let's test simpler: (0, 1) looking at (2, 1) with wall at (1, 1).
    
    // Move unit to (0, 1)
    const unit = engine.getState().units[0];
    unit.pos = { x: 0.5, y: 1.5 }; // Center of (0, 1)
    
    engine.update(100);
    const state = engine.getState();
    
    expect(state.visibleCells).toContain('0,1');
    expect(state.visibleCells).toContain('1,1'); // See the wall
    expect(state.visibleCells).not.toContain('2,1'); // Behind the wall
  });

  it('should not attack enemies if not visible (blocked by wall)', () => {
    // Unit at (0, 1). Enemy at (2, 1). Wall at (1, 1).
    // Distance 2. Attack range 2. Should be in range, but not visible.
    
    // Move unit
    engine.getState().units[0].pos = { x: 0.5, y: 1.5 };
    
    engine.addEnemy({
      id: 'e1',
      pos: { x: 2.5, y: 1.5 },
      hp: 50, maxHp: 50,
      type: 'SwarmMelee',
      damage: 5, attackRange: 1,
    });

    engine.update(100);

    const state = engine.getState();
    const enemy = state.enemies[0];
    const unit = state.units[0];

    expect(enemy.hp).toBe(50); // No damage taken
    expect(unit.state).toBe(UnitState.Idle);
  });

  it('should attack visible enemies in range', () => {
    // Unit at (0, 0). Enemy at (1, 0). Visible.
    engine.addEnemy({
      id: 'e1',
      pos: { x: 1.5, y: 0.5 },
      hp: 50, maxHp: 50,
      type: 'SwarmMelee',
      damage: 5, attackRange: 1,
    });

    engine.update(100);

    const state = engine.getState();
    const enemy = state.enemies[0];
    
    expect(enemy.hp).toBe(30); // 50 - 20
  });
});
