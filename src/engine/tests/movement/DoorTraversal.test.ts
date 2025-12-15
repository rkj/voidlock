import { describe, it, expect, beforeEach } from 'vitest';
import { CoreEngine } from '../../CoreEngine';
import { MapDefinition, CellType, UnitState, CommandType, Door } from '../../../shared/types';

describe('Movement through Doors', () => {
  let engine: CoreEngine;
  
  // 3x1 Map: (0,0) -> Door -> (1,0) -> (2,0)
  const map: MapDefinition = {
    width: 3, height: 1,
    cells: [
        { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } },
        { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } },
        { x: 2, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: true } }
    ],
    doors: [{
        id: 'd1', orientation: 'Vertical', state: 'Closed',
        segment: [{x:0, y:0}, {x:1, y:0}], hp: 100, maxHp: 100, openDuration: 0.2 // Fast open for test
    }],
    spawnPoints: [], extraction: {x:2, y:0}, objectives: []
  };

  beforeEach(() => {
    engine = new CoreEngine(map, 123);
    engine.clearUnits();
    engine.addUnit({
      id: 'u1', pos: { x: 0.5, y: 0.5 }, hp: 100, maxHp: 100,
      state: UnitState.Idle, damage: 10, fireRate: 100, attackRange: 1, sightRange: 5, commandQueue: []
    });
  });

  it('should find path through closed door and wait for it to open', () => {
    // 1. Issue Move Command to (2,0)
    engine.applyCommand({
        type: CommandType.MOVE_TO,
        unitIds: ['u1'],
        target: { x: 2, y: 0 }
    });

    // 2. Unit should start moving
    engine.update(100);
    let state = engine.getState();
    let u1 = state.units[0];
    expect(u1.state).toBe(UnitState.Moving);
    expect(u1.path).toBeDefined(); // Path found!

    // 3. Move until reaching the door (0.5 -> 1.0 boundary)
    // Distance 0.5. Speed 2. Time = 0.25s = 250ms.
    engine.update(200); 
    state = engine.getState();
    u1 = state.units[0];
    // Should be near door.
    // console.log(u1.pos.x);

    // 4. Door should start opening because unit is adjacent (0,0) to door at boundary.
    // engine.update handles door logic.
    // Check door state
    let door = state.map.doors![0];
    // If unit is at 0.9, it's adjacent to door.
    
    // 5. Simulate wait time
    // Door open duration 0.2s = 200ms.
    engine.update(300); // Wait for door
    
    state = engine.getState();
    door = state.map.doors![0];
    u1 = state.units[0];

    // Door should be open now
    expect(door.state).toBe('Open');

    // Unit should have passed through
    // Total time ~600ms. Move 0->2 is dist 2. 1 second.
    // But we waited 200ms for door.
    // So unit should be around x=1.5
    expect(u1.pos.x).toBeGreaterThan(1.0);
  });
});
