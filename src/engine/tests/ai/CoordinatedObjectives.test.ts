import { describe, it, expect, beforeEach } from 'vitest';
import { CoreEngine } from '../../CoreEngine';
import { MapDefinition, CellType, UnitState, Objective } from '../../../shared/types';

describe('Coordinated Objectives', () => {
  let engine: CoreEngine;
  let map: MapDefinition;

  beforeEach(() => {
    // 10x10 map
    const cells = [];
    for(let y=0; y<10; y++) {
        for(let x=0; x<10; x++) {
            cells.push({ x, y, type: CellType.Floor, walls: {n:false, e:false, s:false, w:false} });
        }
    }

    const objectives: Objective[] = [
        { id: 'obj1', kind: 'Recover', state: 'Pending', targetCell: { x: 0, y: 0 } },
        { id: 'obj2', kind: 'Recover', state: 'Pending', targetCell: { x: 9, y: 9 } }
    ];

    map = {
      width: 10, height: 10,
      cells,
      spawnPoints: [], extraction: undefined, objectives
    };

    engine = new CoreEngine(map, 123, [], true, false);
    engine.clearUnits();
  });

  it('should assign different objectives to different units', () => {
    // Add 2 units at (5,5)
    engine.addUnit({
      id: 'u1', pos: { x: 5.5, y: 5.5 }, hp: 100, maxHp: 100, state: UnitState.Idle, damage: 10, fireRate: 100, attackRange: 1, sightRange: 20, speed: 2, commandQueue: []
    });
    engine.addUnit({
      id: 'u2', pos: { x: 5.5, y: 5.5 }, hp: 100, maxHp: 100, state: UnitState.Idle, damage: 10, fireRate: 100, attackRange: 1, sightRange: 20, speed: 2, commandQueue: []
    });

    // Run update
    engine.update(100);

    const u1 = engine.getState().units[0];
    const u2 = engine.getState().units[1];

    expect(u1.state).toBe(UnitState.Moving);
    expect(u2.state).toBe(UnitState.Moving);
    expect(u1.targetPos).toBeDefined();
    expect(u2.targetPos).toBeDefined();

    // Targets should be different
    // Target pos is center of cell (x+0.5, y+0.5)
    const t1 = u1.targetPos!;
    const t2 = u2.targetPos!;

    // Distance between targets should be large (one is 0,0, other is 9,9)
    const dist = Math.sqrt((t1.x - t2.x)**2 + (t1.y - t2.y)**2);
    expect(dist).toBeGreaterThan(1);
  });
});
