import { describe, it, expect } from 'vitest';
import { MapGenerator } from '../../MapGenerator';
import { MapDefinition, CellType, Door, Vector2 } from '../../../shared/types';

describe('MapGenerator.validate', () => {
  const generator = new MapGenerator(123);

  const createBaseMap = (): MapDefinition => ({
    width: 3, height: 1,
    cells: [
      { x: 0, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: true, w: true } },
      { x: 1, y: 0, type: CellType.Floor, walls: { n: true, e: false, s: true, w: false } },
      { x: 2, y: 0, type: CellType.Floor, walls: { n: true, e: true, s: true, w: false } }
    ],
    spawnPoints: [{ id: 'sp1', pos: { x: 0, y: 0 }, radius: 1 }],
    extraction: { x: 2, y: 0 },
    objectives: [{ id: 'o1', kind: 'Recover', targetCell: { x: 2, y: 0 } }],
    doors: []
  });

  it('should validate a simple connected map', () => {
    const map = createBaseMap();
    const result = generator.validate(map);
    if (!result.isValid) console.log('Validation Issues:', result.issues);
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should fail if extraction is unreachable due to a wall', () => {
    const map = createBaseMap();
    // Add a wall between (0,0) and (1,0)
    map.cells[0].walls.e = true;
    map.cells[1].walls.w = true;

    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContainEqual(expect.stringContaining('Extraction point at (2, 0) is not reachable'));
  });

  it('should pass if a Closed door blocks the path (units can open it)', () => {
    const map = createBaseMap();
    // Wall between (0,0) and (1,0)
    map.cells[0].walls.e = true;
    map.cells[1].walls.w = true;
    
    // Add Closed Door
    map.doors = [{
        id: 'd1',
        orientation: 'Vertical',
        state: 'Closed',
        hp: 10, maxHp: 10, openDuration: 1,
        segment: [{x:0, y:0}, {x:1, y:0}]
    }];

    const result = generator.validate(map);
    // This is expected to FAIL currently, based on my reading of the code.
    // I want to assert the behavior I WANT (which is PASS), then fix the code.
    expect(result.isValid).toBe(true); 
  });

  it('should pass if an Open door connects the path', () => {
    const map = createBaseMap();
    map.cells[0].walls.e = true;
    map.cells[1].walls.w = true;
    
    map.doors = [{
        id: 'd1',
        orientation: 'Vertical',
        state: 'Open',
        hp: 10, maxHp: 10, openDuration: 1,
        segment: [{x:0, y:0}, {x:1, y:0}]
    }];

    const result = generator.validate(map);
    expect(result.isValid).toBe(true);
  });
});
