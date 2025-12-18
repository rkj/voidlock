import { describe, it, expect } from 'vitest';
import { CoreEngine } from '../CoreEngine';
import { MapDefinition, CellType, MissionType, UnitState, CommandType } from '../../shared/types';

describe('Mission Types', () => {
  const mockMap: MapDefinition = {
    width: 20, height: 20,
    cells: Array(400).fill(null).map((_, i) => ({
      x: i % 20, y: Math.floor(i / 20), type: CellType.Floor,
      walls: { n: false, e: false, s: false, w: false }
    })),
    extraction: { x: 0, y: 0 }
  };

  it('should initialize Extract Artifacts mission with 3 artifact objectives', () => {
    const engine = new CoreEngine(mockMap, 123, [], true, MissionType.ExtractArtifacts);
    const state = engine.getState();
    
    const artifacts = state.objectives.filter(o => o.kind === 'Recover' && o.id.startsWith('artifact-'));
    expect(artifacts.length).toBe(3);
    expect(state.objectives.length).toBe(3);
  });

  it('should initialize Destroy Hive mission with a Hive enemy and Kill objective', () => {
    const engine = new CoreEngine(mockMap, 123, [], true, MissionType.DestroyHive);
    const state = engine.getState();
    
    const hiveObj = state.objectives.find(o => o.kind === 'Kill' && o.id === 'obj-hive');
    expect(hiveObj).toBeDefined();
    
    const hiveEnemy = state.enemies.find(e => e.type === 'Hive');
    expect(hiveEnemy).toBeDefined();
    expect(hiveEnemy?.id).toBe('enemy-hive');
  });

  it('should complete Kill objective when Hive dies', () => {
    const engine = new CoreEngine(mockMap, 123, [], true, MissionType.DestroyHive);
    let state = engine.getState();
    const hive = state.enemies.find(e => e.type === 'Hive')!;
    
    // Simulate Hive death (manual HP reduction for test)
    // CoreEngine update cleans up dead enemies, so we need to damage it via combat or hack
    // Hack: locate the enemy in the engine's state and set HP to 0
    // But we can't access private state directly easily.
    // We can spawn a unit next to it and make it attack? Or just trust logic?
    // Let's rely on logic verification via unit test logic.
    // We can use `addEnemy` to add a dummy unit that kills it?
    // Or just checking if the update loop handles it.
    // We can iterate `update` and force kill.
    // Actually, `state` returned by `getState` is a copy.
    // The engine instance has private state.
    // We can't modify it easily.
    
    // Let's simulate combat by adding a super unit.
    engine.addUnit({
        id: 'god-unit', pos: { x: hive.pos.x, y: hive.pos.y }, hp: 1000, maxHp: 1000,
        state: UnitState.Idle, damage: 1000, fireRate: 10, attackRange: 5, sightRange: 10,
        commandQueue: [], engagementPolicy: 'ENGAGE'
    });
    
    // Update enough times to kill
    engine.update(100); 
    engine.update(100); 
    
    state = engine.getState();
    const hiveObj = state.objectives.find(o => o.id === 'obj-hive');
    expect(hiveObj?.state).toBe('Completed');
  });
});
