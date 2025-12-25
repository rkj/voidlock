import { describe, it, expect, beforeEach } from 'vitest';
import { CoreEngine } from '../../CoreEngine';
import { MapDefinition, CellType, UnitState } from '../../../shared/types';

describe('Enemy Movement', () => {
  let engine: CoreEngine;
  let map: MapDefinition;

  beforeEach(() => {
    // 20x20 open map
    const cells = [];
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        cells.push({ x, y, type: CellType.Floor,  });
      }
    }
    map = {
      width: 20, height: 20,
      cells,
      spawnPoints: [], extraction: undefined, objectives: []
    };

    engine = new CoreEngine(map, 123, [], true, false);
    engine.clearUnits();
  });

  it('should explore a significant portion of the map over time (not jitter)', () => {
    engine.addEnemy({
      id: 'e1', pos: { x: 15.5, y: 15.5 }, hp: 100, maxHp: 100, type: 'SwarmMelee', damage: 10, fireRate: 100, attackRange: 1, speed: 2
    });

    // Dummy soldier far away
    engine.addUnit({
        id: 's1', pos: { x: 0.5, y: 0.5 }, hp: 100, maxHp: 100, state: UnitState.Idle, damage: 0, fireRate: 0, attackRange: 0, sightRange: 0, speed: 2, commandQueue: []
    });

    const visited = new Set<string>();
    const track = () => {
        const e = engine.getState().enemies[0];
        visited.add(`${Math.floor(e.pos.x)},${Math.floor(e.pos.y)}`);
    };

    // Run for 100 ticks (10 seconds)
    // Speed is ~2 tiles/sec. Should cover ~20 tiles distance.
    // If it jitters back and forth, unique visited cells will be low (e.g., 2-3).
    for (let i = 0; i < 100; i++) {
        engine.update(100);
        if (i % 5 === 0) {
            track();
        }
    }

    // console.log(`Visited cells count: ${visited.size}`);
    // Expect at least 5 unique cells
    expect(visited.size).toBeGreaterThan(5);
  });
});
