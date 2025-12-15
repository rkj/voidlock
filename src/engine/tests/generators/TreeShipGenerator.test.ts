import { describe, it, expect } from 'vitest';
import { TreeShipGenerator } from '../../generators/TreeShipGenerator';
import { CellType } from '../../../shared/types';

describe('TreeShipGenerator', () => {
  it('should generate a valid map with a tree structure', () => {
    const generator = new TreeShipGenerator(12345, 24, 24);
    const map = generator.generate();

    expect(map.width).toBe(24);
    expect(map.height).toBe(24);
    
    const floors = map.cells.filter(c => c.type === CellType.Floor);
    expect(floors.length).toBeGreaterThan(20);

    // Basic feature check
    expect(map.spawnPoints?.length).toBeGreaterThan(0);
    expect(map.extraction).toBeDefined();
    expect(map.objectives?.length).toBeGreaterThan(0);
    expect(map.doors?.length).toBeGreaterThan(0);
  });
});
