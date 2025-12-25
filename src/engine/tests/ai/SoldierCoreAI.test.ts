import { describe, it, expect, beforeEach } from 'vitest';
import { CoreEngine } from '../../CoreEngine';
import { MapDefinition, CellType, UnitState, CommandType } from '../../../shared/types';

describe('SoldierCoreAI', () => {
  const mockMap: MapDefinition = {
    width: 10, height: 10,
    cells: Array(100).fill(null).map((_, i) => ({
      x: i % 10, y: Math.floor(i / 10), type: CellType.Floor,
      
    })),
    spawnPoints: [{ id: 's1', pos: { x: 1, y: 1 }, radius: 1 }],
    extraction: { x: 9, y: 9 }
  };

  let engine: CoreEngine;

  beforeEach(() => {
    engine = new CoreEngine(mockMap, 123, [], true, false); // agentControlEnabled = true
    engine.clearUnits(); // Clear default spawns
  });

  it('should move toward visible enemies if in ENGAGE mode and idle', () => {
    engine.addUnit({
      id: 'u1', pos: { x: 1.5, y: 1.5 }, hp: 100, maxHp: 100,
      state: UnitState.Idle, damage: 10, fireRate: 1000, attackRange: 2, sightRange: 10,
      speed: 2,
      commandQueue: [], engagementPolicy: 'ENGAGE'
    });
    engine.addEnemy({
      id: 'e1', pos: { x: 5.5, y: 5.5 }, hp: 50, maxHp: 50, type: 'SwarmMelee',
      damage: 10, fireRate: 1000, attackRange: 1, speed: 2
    });

    engine.update(100); // 1 tick
    const state = engine.getState();
    const u1 = state.units[0];
    
    expect(u1.state).toBe(UnitState.Moving);
    expect(u1.targetPos).toBeDefined();
    // Distance should decrease or at least be moving in the right quadrant
    const distBefore = Math.sqrt((5.5-1.5)**2 + (5.5-1.5)**2);
    const distAfter = Math.sqrt((5.5-u1.targetPos!.x)**2 + (5.5-u1.targetPos!.y)**2);
    expect(distAfter).toBeLessThan(distBefore);
  });

  it('should retreat if HP is low and enemies are present', () => {
    engine.addUnit({
      id: 'u1', pos: { x: 5.5, y: 5.5 }, hp: 20, maxHp: 100, // 20% HP
      state: UnitState.Idle, damage: 10, fireRate: 1000, attackRange: 2, sightRange: 10,
      speed: 2,
      commandQueue: [], engagementPolicy: 'ENGAGE'
    });
    engine.addEnemy({
      id: 'e1', pos: { x: 6.5, y: 5.5 }, hp: 50, maxHp: 50, type: 'SwarmMelee',
      damage: 10, fireRate: 1000, attackRange: 1, speed: 2
    });

    // We need to discover some cells first so it has somewhere to retreat to
    // Update once to discover (5,5) and surround
    engine.update(100); 
    
    // Check if it's retreating
    const state = engine.getState();
    const u1 = state.units[0];
    
    expect(u1.engagementPolicy).toBe('IGNORE');
    expect(u1.state).toBe(UnitState.Moving);
    expect(u1.targetPos).toBeDefined();
    // Should move away from (6.5, 5.5)
    // If it was at (5.5, 5.5) and enemy at (6.5, 5.5), any move to (4.5, 5.5) or similar is good.
    expect(u1.targetPos!.x).toBeLessThan(5.5 + 0.1); 
  });

  it('should group up with allies if isolated and threats are present', () => {
    engine.addUnit({
      id: 'u1', pos: { x: 1.5, y: 1.5 }, hp: 100, maxHp: 100,
      state: UnitState.Idle, damage: 10, fireRate: 1000, attackRange: 2, sightRange: 10,
      speed: 2,
      commandQueue: []
    });
    engine.addUnit({
      id: 'u2', pos: { x: 8.5, y: 8.5 }, hp: 100, maxHp: 100,
      state: UnitState.Idle, damage: 10, fireRate: 1000, attackRange: 2, sightRange: 10,
      speed: 2,
      commandQueue: []
    });
    engine.addEnemy({
      id: 'e1', pos: { x: 5.5, y: 5.5 }, hp: 50, maxHp: 50, type: 'SwarmMelee',
      damage: 10, fireRate: 1000, attackRange: 1, speed: 2
    });

    engine.update(100);
    const state = engine.getState();
    const u1 = state.units.find(u => u.id === 'u1')!;
    
    // u1 is isolated from u2 (dist > 5) and has threat e1
    expect(u1.state).toBe(UnitState.Moving);
    expect(u1.engagementPolicy).toBe('IGNORE');
    // Should move toward u2 (8.5, 8.5)
    expect(u1.targetPos!.x + u1.targetPos!.y).toBeGreaterThan(1.5 + 1.5);
  });
});
