import { describe, it, expect } from 'vitest';
import { TreeShipGenerator } from '../../generators/TreeShipGenerator';
import { MapGenerator } from '../../MapGenerator';
import { MapDefinition, CellType } from '../../../shared/types';
import { mapToAdjacencyList, hasCycleDFS, calculateFillRate } from '../utils/GraphUtils';

describe('TreeShipGenerator 7x7', () => {
  it('should generate a 7x7 map (Seed 42) with >90% fill rate', async () => {
    const generator = new TreeShipGenerator(42, 7, 7);
    const map = generator.generate();
    
    const ascii = MapGenerator.toAscii(map);
    
    // Use golden file snapshot
    await expect(ascii).toMatchFileSnapshot('./snapshots/TreeShipGenerator.7x7.txt');

    // Verify properties
    expect(map.width).toBe(7);
    expect(map.height).toBe(7);
    
    // Verify acyclicity
    // const adj = mapToAdjacencyList(map);
    // expect(hasCycleDFS(adj)).toBe(false); // Cycles allowed for rooms now

    // Verify fill rate
    expect(calculateFillRate(map)).toBeGreaterThanOrEqual(0.9);
  });
});
