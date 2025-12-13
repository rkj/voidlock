import { describe, it, expect } from 'vitest';
import { MapGenerator } from './MapGenerator';
import { CellType } from '../shared/types';

describe('MapGenerator', () => {
  it('should generate a map with cells and walls', () => {
    const generator = new MapGenerator(123);
    const map = generator.generate(16, 16);

    expect(map.width).toBe(16);
    expect(map.height).toBe(16);
    expect(map.cells.length).toBe(256);
    
    // All should be floor
    const floors = map.cells.filter(c => c.type === CellType.Floor);
    expect(floors.length).toBe(256);
    
    // Check extraction
    expect(map.extraction).toBeDefined();
    
    // Check some walls are removed (it's a maze)
    // A grid of 16x16 with all walls = 256 cells * 4 walls = 1024 walls (double counted)
    // A maze should have opened paths.
    // Check if any cell has a false wall
    const openWalls = map.cells.some(c => !c.walls.n || !c.walls.e || !c.walls.s || !c.walls.w);
    expect(openWalls).toBe(true);
  });

  it('should be deterministic with same seed', () => {
    const gen1 = new MapGenerator(555);
    const map1 = gen1.generate(10, 10);

    const gen2 = new MapGenerator(555);
    const map2 = gen2.generate(10, 10);

    expect(map1).toEqual(map2);
  });
});