import { describe, it, expect } from 'vitest';
import { MapGenerator } from './MapGenerator';
import { CellType } from '../shared/types';

describe('MapGenerator', () => {
  it('should generate a map with floors and walls', () => {
    const generator = new MapGenerator(123);
    const map = generator.generate(20, 20);

    expect(map.width).toBe(20);
    expect(map.height).toBe(20);
    expect(map.cells.length).toBe(400);
    
    const floors = map.cells.filter(c => c.type === CellType.Floor);
    expect(floors.length).toBeGreaterThan(0);
    
    expect(map.extraction).toBeDefined();
    expect(map.objectives?.length).toBe(1);
    expect(map.spawnPoints?.length).toBe(3);
  });

  it('should be deterministic with same seed', () => {
    const gen1 = new MapGenerator(555);
    const map1 = gen1.generate(10, 10);

    const gen2 = new MapGenerator(555);
    const map2 = gen2.generate(10, 10);

    expect(map1).toEqual(map2);
  });
});
