import { describe, it, expect, beforeEach } from 'vitest';
import { CoreEngine } from '../../CoreEngine';
import { MapDefinition, CellType, UnitState, SquadConfig, CommandType } from '../../../shared/types';

describe('Coordinated Exploration', () => {
  let engine: CoreEngine;
  let map: MapDefinition;

  beforeEach(() => {
    // 5x1 Map: Unknown | Floor | Floor | Floor | Unknown
    // Indices: 0,0 (Floor) | 1,0 (Floor) | 2,0 (Floor) | 3,0 (Floor) | 4,0 (Floor)
    // We will manually manipulate discovery.
    
    map = {
        width: 5,
        height: 1,
        cells: [
            { x: 0, y: 0, type: CellType.Floor,  },
            { x: 1, y: 0, type: CellType.Floor,  },
            { x: 2, y: 0, type: CellType.Floor,  },
            { x: 3, y: 0, type: CellType.Floor,  },
            { x: 4, y: 0, type: CellType.Floor,  }
        ],
        spawnPoints: [], extraction: undefined, objectives: []
    };

    const squad: SquadConfig = [];
    engine = new CoreEngine(map, 123, squad, true, false); // agentControl = true
    engine.clearUnits();
  });

  it('should assign different exploration targets to units', () => {
    // Add 2 units at center (2,0)
    engine.addUnit({
      id: 'u1', pos: { x: 2.5, y: 0.5 }, hp: 100, maxHp: 100, state: UnitState.Idle, damage: 10, fireRate: 100, attackRange: 5, sightRange: 1, speed: 2, commandQueue: []
    });
    engine.addUnit({
      id: 'u2', pos: { x: 2.5, y: 0.5 }, hp: 100, maxHp: 100, state: UnitState.Idle, damage: 10, fireRate: 100, attackRange: 5, sightRange: 1, speed: 2, commandQueue: []
    });

    // Manually set discovered cells to include only center and adjacent
    // Undiscovered: (0,0) and (4,0)
    // Both are at distance 2 from center.
    const state = engine.getState();
    // We need to hack the state to set discovered cells because engine init usually discovers visible ones.
    // engine.state.discoveredCells = ['1,0', '2,0', '3,0']; // But protected.
    
    // We can simulate update. With sightRange 1, they see 2,0 and maybe neighbors 1,0 and 3,0 partially.
    // Let's assume 0,0 and 4,0 are undiscovered.
    
    // Run update.
    engine.update(100);
    
    const u1 = engine.getState().units[0];
    const u2 = engine.getState().units[1];

    expect(u1.state).toBe(UnitState.Moving);
    expect(u2.state).toBe(UnitState.Moving);
    expect(u1.explorationTarget).toBeDefined();
    expect(u2.explorationTarget).toBeDefined();

    // With coordinated exploration, they should target different cells if available.
    // One should target 0,0, other 4,0.
    
    const t1 = u1.explorationTarget!;
    const t2 = u2.explorationTarget!;
    
    // Check they are different
    expect(t1.x === t2.x && t1.y === t2.y).toBe(false);
    
    // Check they are valid targets (0,0 or 4,0)
    const validX = [0, 4];
    expect(validX).toContain(Math.floor(t1.x));
    expect(validX).toContain(Math.floor(t2.x));
  });
});
